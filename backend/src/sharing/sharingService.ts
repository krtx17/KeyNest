import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { AuditService } from '../audit/auditService.ts';
import type { MemberRole } from '../workspaces/workspaceService.ts';
import type { ItemRecord, ItemKeyRecord } from '../items/itemService.ts';

export interface RotationTaskRecord {
  id: string;
  workspace_id: string;
  item_id: string;
  triggered_by: string;
  status: 'open' | 'done' | 'dismissed';
  created_at: string;
  completed_at: string | null;
}

export class SharingService {
  /**
   * Helper to resolve user's role in a workspace.
   */
  private static getUserRole(userId: string, workspaceId: string): MemberRole | null {
    const db = getDatabase();
    const mem = db.queryOne<{ role: MemberRole }>(
      `SELECT role FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'`,
      [workspaceId, userId]
    );
    return mem ? mem.role : null;
  }

  /**
   * Shares an item with a named teammate by storing a wrapped item key.
   */
  static shareItem(params: {
    actorId: string;
    itemId: string;
    recipientUserId: string;
    wrappedKey: string;
    permission: 'view_copy' | 'edit';
  }) {
    const db = getDatabase();
    const item = db.queryOne<ItemRecord>(`SELECT * FROM items WHERE id = ? AND deleted_at IS NULL`, [params.itemId]);
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
    }

    const actorRole = this.getUserRole(params.actorId, item.workspace_id);
    if (!actorRole) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this workspace.');
    }

    // Verify recipient is active member of workspace
    const recipientMem = db.queryOne<{ id: string }>(
      `SELECT id FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'`,
      [item.workspace_id, params.recipientUserId]
    );
    if (!recipientMem) {
      throw new AppError(400, 'RECIPIENT_NOT_MEMBER', 'Recipient must be an active member of the workspace.');
    }

    const now = new Date().toISOString();

    // Check if grant already exists
    const existingKey = db.queryOne<ItemKeyRecord>(
      `SELECT id FROM item_keys WHERE item_id = ? AND recipient_user_id = ? AND revoked_at IS NULL`,
      [params.itemId, params.recipientUserId]
    );

    if (existingKey) {
      db.execute(
        `UPDATE item_keys SET wrapped_key = ?, permission = ?, granted_by = ?, granted_at = ? WHERE id = ?`,
        [params.wrappedKey, params.permission, params.actorId, now, existingKey.id]
      );
    } else {
      const keyId = 'key_' + crypto.randomUUID();
      db.execute(
        `INSERT INTO item_keys (id, item_id, recipient_user_id, wrapped_key, permission, key_version, granted_by, granted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          keyId,
          params.itemId,
          params.recipientUserId,
          params.wrappedKey,
          params.permission,
          item.key_version,
          params.actorId,
          now,
        ]
      );
    }

    AuditService.log({
      workspaceId: item.workspace_id,
      actorUserId: params.actorId,
      action: 'item.share',
      targetType: 'item',
      targetId: params.itemId,
      details: `Shared access with recipient ${params.recipientUserId} with ${params.permission} permission.`,
    });

    return {
      shared: true,
      itemId: params.itemId,
      recipientUserId: params.recipientUserId,
      permission: params.permission,
    };
  }

  /**
   * Revokes an item share from a user and creates a rotation task.
   */
  static revokeShare(params: {
    actorId: string;
    itemId: string;
    recipientUserId: string;
  }) {
    const db = getDatabase();
    const item = db.queryOne<ItemRecord>(`SELECT * FROM items WHERE id = ? AND deleted_at IS NULL`, [params.itemId]);
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
    }

    const actorRole = this.getUserRole(params.actorId, item.workspace_id);
    if (!actorRole) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this workspace.');
    }

    const now = new Date().toISOString();

    db.execute(
      `UPDATE item_keys SET revoked_at = ? WHERE item_id = ? AND recipient_user_id = ? AND revoked_at IS NULL`,
      [now, params.itemId, params.recipientUserId]
    );

    // Create a rotation task for this credential
    const taskId = 'rot_' + crypto.randomUUID();
    db.execute(
      `INSERT INTO rotation_tasks (id, workspace_id, item_id, triggered_by, status, created_at)
       VALUES (?, ?, ?, ?, 'open', ?)`,
      [taskId, item.workspace_id, params.itemId, `Access revoked from user ${params.recipientUserId}`, now]
    );

    AuditService.log({
      workspaceId: item.workspace_id,
      actorUserId: params.actorId,
      action: 'item.share_revoked',
      targetType: 'item',
      targetId: params.itemId,
      details: `Revoked access from user ${params.recipientUserId}. Rotation task ${taskId} scheduled.`,
    });

    return {
      revoked: true,
      itemId: params.itemId,
      recipientUserId: params.recipientUserId,
      rotationTaskId: taskId,
    };
  }

  /**
   * Offboards a member from a workspace:
   * 1. Marks membership removed & invalidates sessions
   * 2. Bumps workspace key version (key_version + 1)
   * 3. Revokes all item keys and workspace keys
   * 4. Generates rotation tasks for all items previously accessible
   */
  static offboardMember(params: {
    actorId: string;
    workspaceId: string;
    targetUserId: string;
  }) {
    const db = getDatabase();
    const actorRole = this.getUserRole(params.actorId, params.workspaceId);
    if (!actorRole || (actorRole !== 'owner' && actorRole !== 'admin')) {
      throw new AppError(403, 'FORBIDDEN', 'Only workspace owners or admins can offboard members.');
    }

    const targetMem = db.queryOne<{ id: string; role: MemberRole }>(
      `SELECT id, role FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'`,
      [params.workspaceId, params.targetUserId]
    );

    if (!targetMem) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Active member not found in workspace.');
    }

    if (targetMem.role === 'owner') {
      throw new AppError(400, 'CANNOT_OFFBOARD_OWNER', 'Workspace owner cannot be removed. Transfer ownership first.');
    }

    const now = new Date().toISOString();

    // 1. Mark membership removed
    db.execute(
      `UPDATE memberships SET status = 'removed', removed_at = ? WHERE id = ?`,
      [now, targetMem.id]
    );

    // 2. Increment workspace key_version
    db.execute(
      `UPDATE workspaces SET key_version = key_version + 1 WHERE id = ?`,
      [params.workspaceId]
    );

    // 3. Revoke target user's workspace keys
    db.execute(
      `UPDATE workspace_keys SET revoked_at = ? WHERE workspace_id = ? AND recipient_user_id = ? AND revoked_at IS NULL`,
      [now, params.workspaceId, params.targetUserId]
    );

    // 4. Find all items the user had active keys for
    const sharedItems = db.query<{ item_id: string }>(
      `SELECT ik.item_id
       FROM item_keys ik
       JOIN items i ON i.id = ik.item_id
       WHERE i.workspace_id = ? AND ik.recipient_user_id = ? AND ik.revoked_at IS NULL`,
      [params.workspaceId, params.targetUserId]
    );

    // Revoke item keys
    db.execute(
      `UPDATE item_keys SET revoked_at = ?
       WHERE recipient_user_id = ? AND item_id IN (SELECT id FROM items WHERE workspace_id = ?)`,
      [now, params.targetUserId, params.workspaceId]
    );

    // Create rotation tasks for each exposed item
    const createdTasks: string[] = [];
    for (const item of sharedItems) {
      const taskId = 'rot_' + crypto.randomUUID();
      db.execute(
        `INSERT INTO rotation_tasks (id, workspace_id, item_id, triggered_by, status, created_at)
         VALUES (?, ?, ?, ?, 'open', ?)`,
        [taskId, params.workspaceId, item.item_id, `Teammate ${params.targetUserId} offboarded on ${now}`, now]
      );
      createdTasks.push(taskId);
    }

    AuditService.log({
      workspaceId: params.workspaceId,
      actorUserId: params.actorId,
      action: 'member.remove_and_rotate',
      targetType: 'user',
      targetId: params.targetUserId,
      details: `Removed from workspace. Incremented key version. Generated ${createdTasks.length} credential rotation tasks.`,
    });

    return {
      offboarded: true,
      userId: params.targetUserId,
      workspaceId: params.workspaceId,
      rotationTasksGenerated: createdTasks.length,
      tasks: createdTasks,
    };
  }

  /**
   * Retrieves all rotation tasks for a workspace.
   */
  static getRotationTasks(userId: string, workspaceId: string) {
    const db = getDatabase();
    const role = this.getUserRole(userId, workspaceId);
    if (!role) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this workspace.');
    }

    const tasks = db.query<RotationTaskRecord>(
      `SELECT * FROM rotation_tasks WHERE workspace_id = ? ORDER BY created_at DESC`,
      [workspaceId]
    );

    return tasks.map((t) => ({
      id: t.id,
      itemId: t.item_id,
      triggeredBy: t.triggered_by,
      status: t.status,
      isDone: t.status === 'done',
      createdAt: t.created_at,
      completedAt: t.completed_at,
    }));
  }

  /**
   * Toggles rotation task completion status.
   */
  static toggleRotationTask(taskId: string, isDone: boolean) {
    const db = getDatabase();
    const task = db.queryOne<RotationTaskRecord>(`SELECT * FROM rotation_tasks WHERE id = ?`, [taskId]);
    if (!task) {
      throw new AppError(404, 'TASK_NOT_FOUND', 'Rotation task not found.');
    }

    const now = isDone ? new Date().toISOString() : null;
    const status = isDone ? 'done' : 'open';

    db.execute(`UPDATE rotation_tasks SET status = ?, completed_at = ? WHERE id = ?`, [status, now, taskId]);

    return {
      id: taskId,
      isDone,
      status,
      completedAt: now,
    };
  }
}
