import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { AuditService } from '../audit/auditService.ts';
import { EmailService } from '../email/emailService.ts';
import { config } from '../config/index.ts';
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

export interface ItemInvitationRecord {
  id: string;
  item_id: string;
  workspace_id: string;
  invited_by: string;
  recipient_name: string;
  recipient_email: string;
  service_name: string;
  wrapped_key: string;
  permission: 'view_copy' | 'edit';
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  revoked_at: string | null;
  created_at: string;
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

  /**
   * Creates and dispatches a single-use email invitation to access a shared password.
   * Throws HTTP 503 if email delivery is not configured on the server.
   */
  static async createItemInvitation(params: {
    actorId: string;
    itemId: string;
    recipientName: string;
    recipientEmail: string;
    permission: 'view_copy' | 'edit';
    serviceName?: string;
    wrappedKey?: string;
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

    const normEmail = params.recipientEmail.trim().toLowerCase();
    if (!normEmail || !normEmail.includes('@')) {
      throw new AppError(400, 'INVALID_EMAIL', 'A valid recipient email address is required.');
    }

    const actorUser = db.queryOne<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE id = ?`,
      [params.actorId]
    );
    const senderName = actorUser ? actorUser.email.split('@')[0] : 'Teammate';
    const senderEmail = actorUser ? actorUser.email : 'teammate@keynest.internal';
    const serviceName = params.serviceName?.trim() || 'Shared Password';

    // Generate secure 32-byte single-use token and its SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Send email invitation first. If email delivery is unconfigured, this will throw 503.
    await EmailService.sendItemInvitation({
      recipientEmail: normEmail,
      recipientName: params.recipientName.trim(),
      senderName,
      senderEmail,
      serviceName,
      permission: params.permission,
      inviteToken: rawToken,
      expiresAt,
    });

    const invId = 'inv_' + crypto.randomUUID();
    db.execute(
      `INSERT INTO item_invitations (id, item_id, workspace_id, invited_by, recipient_name, recipient_email, service_name, wrapped_key, permission, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invId,
        item.id,
        item.workspace_id,
        params.actorId,
        params.recipientName.trim(),
        normEmail,
        serviceName,
        params.wrappedKey || '',
        params.permission,
        tokenHash,
        expiresAt,
        nowIso,
      ]
    );

    AuditService.log({
      workspaceId: item.workspace_id,
      actorUserId: params.actorId,
      action: 'item.invite_created',
      targetType: 'item_invitation',
      targetId: invId,
      details: `Created invitation for ${normEmail} (${params.recipientName}) with ${params.permission} permission.`,
    });

    return {
      id: invId,
      itemId: item.id,
      recipientEmail: normEmail,
      recipientName: params.recipientName.trim(),
      serviceName,
      permission: params.permission,
      status: 'pending' as const,
      createdAt: nowIso,
      expiresAt,
      // For test verification only: include rawToken when NODE_ENV === 'test'
      ...(config.NODE_ENV === 'test' ? { testToken: rawToken } : {}),
    };
  }

  /**
   * Lists all invitations for an item, computing live status (pending, accepted, expired, revoked).
   */
  static listItemInvitations(params: { actorId: string; itemId: string }) {
    const db = getDatabase();
    const item = db.queryOne<ItemRecord>(`SELECT * FROM items WHERE id = ? AND deleted_at IS NULL`, [params.itemId]);
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
    }

    const actorRole = this.getUserRole(params.actorId, item.workspace_id);
    if (!actorRole) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this workspace.');
    }

    const rows = db.query<ItemInvitationRecord>(
      `SELECT * FROM item_invitations WHERE item_id = ? ORDER BY created_at DESC`,
      [params.itemId]
    );

    const nowMs = Date.now();
    return rows.map((inv) => {
      let status: 'pending' | 'accepted' | 'expired' | 'revoked';
      if (inv.revoked_at) {
        status = 'revoked';
      } else if (inv.accepted_at) {
        status = 'accepted';
      } else if (new Date(inv.expires_at).getTime() < nowMs) {
        status = 'expired';
      } else {
        status = 'pending';
      }

      return {
        id: inv.id,
        itemId: inv.item_id,
        recipientName: inv.recipient_name,
        recipientEmail: inv.recipient_email,
        serviceName: inv.service_name,
        permission: inv.permission,
        status,
        invitedBy: inv.invited_by,
        createdAt: inv.created_at,
        expiresAt: inv.expires_at,
        acceptedAt: inv.accepted_at,
        acceptedBy: inv.accepted_by,
        revokedAt: inv.revoked_at,
      };
    });
  }

  /**
   * Revokes / cancels an invitation.
   */
  static revokeItemInvitation(params: { actorId: string; itemId: string; invitationId: string }) {
    const db = getDatabase();
    const item = db.queryOne<ItemRecord>(`SELECT * FROM items WHERE id = ? AND deleted_at IS NULL`, [params.itemId]);
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
    }

    const actorRole = this.getUserRole(params.actorId, item.workspace_id);
    if (!actorRole) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this workspace.');
    }

    const inv = db.queryOne<ItemInvitationRecord>(
      `SELECT * FROM item_invitations WHERE id = ? AND item_id = ?`,
      [params.invitationId, params.itemId]
    );
    if (!inv) {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found.');
    }

    const now = new Date().toISOString();
    db.execute(`UPDATE item_invitations SET revoked_at = ? WHERE id = ?`, [now, inv.id]);

    // If invitation was accepted, revoke the active item keys as well
    if (inv.accepted_by) {
      db.execute(
        `UPDATE item_keys SET revoked_at = ? WHERE item_id = ? AND recipient_user_id = ? AND revoked_at IS NULL`,
        [now, inv.item_id, inv.accepted_by]
      );
    }

    AuditService.log({
      workspaceId: inv.workspace_id,
      actorUserId: params.actorId,
      action: 'item.invite_revoked',
      targetType: 'item_invitation',
      targetId: inv.id,
      details: `Revoked invitation for ${inv.recipient_email}.`,
    });

    return {
      revoked: true,
      invitationId: inv.id,
    };
  }

  /**
   * Verifies an invitation token without revealing sensitive credential data.
   */
  static verifyInvitation(rawToken: string) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new AppError(400, 'INVALID_TOKEN', 'A valid token is required.');
    }

    const db = getDatabase();
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const inv = db.queryOne<ItemInvitationRecord>(
      `SELECT * FROM item_invitations WHERE token_hash = ?`,
      [tokenHash]
    );
    if (!inv) {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation link is invalid or expired.');
    }

    let status: 'pending' | 'accepted' | 'expired' | 'revoked';
    if (inv.revoked_at) {
      status = 'revoked';
    } else if (inv.accepted_at) {
      status = 'accepted';
    } else if (new Date(inv.expires_at).getTime() < Date.now()) {
      status = 'expired';
    } else {
      status = 'pending';
    }

    const sender = db.queryOne<{ email: string }>(`SELECT email FROM users WHERE id = ?`, [inv.invited_by]);
    const senderName = sender ? sender.email.split('@')[0] : 'Teammate';

    return {
      isValid: status === 'pending',
      status,
      itemId: inv.item_id,
      serviceName: inv.service_name || 'Shared Password',
      recipientName: inv.recipient_name,
      recipientEmail: inv.recipient_email,
      senderName,
      senderEmail: sender?.email || '',
      permission: inv.permission,
      expiresAt: inv.expires_at,
    };
  }

  /**
   * Accepts an invitation link.
   * Enforces that the authenticated user's email strictly matches the recipient_email on the invitation.
   */
  static acceptItemInvitation(params: { userId: string; userEmail: string; rawToken: string }) {
    if (!params.rawToken || typeof params.rawToken !== 'string') {
      throw new AppError(400, 'INVALID_TOKEN', 'A valid token is required.');
    }

    const db = getDatabase();
    const tokenHash = crypto.createHash('sha256').update(params.rawToken).digest('hex');

    const inv = db.queryOne<ItemInvitationRecord>(
      `SELECT * FROM item_invitations WHERE token_hash = ?`,
      [tokenHash]
    );
    if (!inv) {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation link is invalid or expired.');
    }

    if (inv.revoked_at) {
      throw new AppError(410, 'INVITATION_REVOKED', 'This invitation has been revoked by the sender.');
    }
    if (inv.accepted_at) {
      throw new AppError(409, 'INVITATION_ALREADY_ACCEPTED', 'This invitation has already been accepted.');
    }
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      throw new AppError(410, 'INVITATION_EXPIRED', 'This invitation link has expired.');
    }

    // Strict verification: authenticated user's email MUST match invited email
    const currentEmail = params.userEmail.trim().toLowerCase();
    const invitedEmail = inv.recipient_email.trim().toLowerCase();
    if (currentEmail !== invitedEmail) {
      throw new AppError(
        403,
        'EMAIL_MISMATCH',
        `This invitation was sent to ${inv.recipient_email}. You are currently signed in as ${params.userEmail}. Please sign in with the invited email to accept access.`
      );
    }

    const item = db.queryOne<ItemRecord>(
      `SELECT * FROM items WHERE id = ? AND deleted_at IS NULL`,
      [inv.item_id]
    );
    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'The shared password is no longer available.');
    }

    const now = new Date().toISOString();

    // Mark invitation accepted
    db.execute(
      `UPDATE item_invitations SET accepted_at = ?, accepted_by = ? WHERE id = ?`,
      [now, params.userId, inv.id]
    );

    // Ensure recipient has membership in the workspace
    const existingMem = db.queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM memberships WHERE workspace_id = ? AND user_id = ?`,
      [inv.workspace_id, params.userId]
    );
    if (!existingMem) {
      db.execute(
        `INSERT INTO memberships (id, workspace_id, user_id, role, status, joined_at)
         VALUES (?, ?, ?, 'member', 'active', ?)`,
        ['mem_' + crypto.randomUUID(), inv.workspace_id, params.userId, now]
      );
    } else if (existingMem.status !== 'active') {
      db.execute(
        `UPDATE memberships SET status = 'active', removed_at = NULL WHERE id = ?`,
        [existingMem.id]
      );
    }

    // Grant access via item_keys
    const existingKey = db.queryOne<ItemKeyRecord>(
      `SELECT id FROM item_keys WHERE item_id = ? AND recipient_user_id = ? AND revoked_at IS NULL`,
      [inv.item_id, params.userId]
    );
    if (existingKey) {
      db.execute(
        `UPDATE item_keys SET permission = ?, key_version = ?, granted_at = ? WHERE id = ?`,
        [inv.permission, item.key_version, now, existingKey.id]
      );
    } else {
      const keyId = 'key_' + crypto.randomUUID();
      db.execute(
        `INSERT INTO item_keys (id, item_id, recipient_user_id, wrapped_key, permission, key_version, granted_by, granted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          keyId,
          inv.item_id,
          params.userId,
          inv.wrapped_key || 'shared_access_granted',
          inv.permission,
          item.key_version,
          inv.invited_by,
          now,
        ]
      );
    }

    AuditService.log({
      workspaceId: inv.workspace_id,
      actorUserId: params.userId,
      action: 'item.invite_accepted',
      targetType: 'item_invitation',
      targetId: inv.id,
      details: `Invitation accepted by ${params.userEmail}. Access granted with ${inv.permission} permission.`,
    });

    return {
      accepted: true,
      itemId: inv.item_id,
      serviceName: inv.service_name || 'Shared Password',
      permission: inv.permission,
      acceptedAt: now,
    };
  }
}
