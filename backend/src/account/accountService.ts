import { getDatabase } from '../db/connection.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { AuditService } from '../audit/auditService.ts';
import type { WorkspaceRecord } from '../workspaces/workspaceService.ts';
import type { ItemRecord } from '../items/itemService.ts';

export class AccountService {
  /**
   * Exports vault items for client-side download.
   * Requires recent server-verified step-up elevation.
   */
  static exportVault(userId: string) {
    const db = getDatabase();

    // Fetch all active items across user's active workspaces
    const items = db.query<ItemRecord>(
      `SELECT i.* FROM items i
       JOIN memberships m ON m.workspace_id = i.workspace_id
       WHERE m.user_id = ? AND m.status = 'active' AND i.deleted_at IS NULL
       ORDER BY i.created_at ASC`,
      [userId]
    );

    const workspaces = db.query<WorkspaceRecord>(
      `SELECT w.* FROM workspaces w
       JOIN memberships m ON m.workspace_id = w.id
       WHERE m.user_id = ? AND m.status = 'active' AND w.deleted_at IS NULL`,
      [userId]
    );

    AuditService.log({
      actorUserId: userId,
      action: 'account.export',
      outcome: 'OK',
      details: `Vault data archive exported. Count: ${items.length} records.`,
    });

    return {
      exportedAt: new Date().toISOString(),
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        kind: w.kind,
      })),
      items: items.map((i) => ({
        id: i.id,
        workspaceId: i.workspace_id,
        payloadEnc: i.payload_enc,
        nonce: i.nonce,
        encVersion: i.enc_version,
        keyVersion: i.key_version,
        revision: i.revision,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
      })),
    };
  }

  /**
   * Deletes an account.
   * Requires transferring ownership of any multi-member team workspaces first.
   */
  static deleteAccount(userId: string) {
    const db = getDatabase();

    // Check if user is owner of any team workspaces with other active members
    const ownedTeamWorkspaces = db.query<WorkspaceRecord>(
      `SELECT w.* FROM workspaces w
       WHERE w.owner_id = ? AND w.kind = 'team' AND w.deleted_at IS NULL`,
      [userId]
    );

    for (const ws of ownedTeamWorkspaces) {
      const activeOtherMembers = db.queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM memberships
         WHERE workspace_id = ? AND user_id != ? AND status = 'active'`,
        [ws.id, userId]
      );

      if (activeOtherMembers && Number(activeOtherMembers.count) > 0) {
        throw new AppError(
          400,
          'TRANSFER_OWNERSHIP_FIRST',
          `Cannot delete account: you are owner of team workspace "${ws.name}" with active members. Transfer ownership or remove members first.`
        );
      }
    }

    const now = new Date().toISOString();

    // Soft delete/lock user account
    db.execute(`UPDATE users SET status = 'deleted', updated_at = ? WHERE id = ?`, [now, userId]);

    // Invalidate all sessions
    db.execute(`UPDATE sessions SET revoked_at = ? WHERE user_id = ?`, [now, userId]);

    // Mark personal workspaces deleted
    db.execute(`UPDATE workspaces SET deleted_at = ? WHERE owner_id = ? AND kind = 'personal'`, [now, userId]);

    AuditService.log({
      actorUserId: userId,
      action: 'account.delete',
      outcome: 'OK',
      details: 'Account scheduled for deletion and sessions revoked.',
    });

    return {
      deleted: true,
      userId,
    };
  }
}
