import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.ts';
import { WorkspaceService } from '../workspaces/workspaceService.ts';
import { ItemService } from '../items/itemService.ts';
import { SharingService } from '../sharing/sharingService.ts';
import { AuditService } from '../audit/auditService.ts';
import type { UserRecord } from '../auth/authService.ts';

/**
 * Frontend Adapter that shapes backend database records to match the
 * exact TypeScript interfaces expected by phase 2/src/types/vault.ts.
 */
export class FrontendMockAdapter {
  static getState(userId: string) {
    const db = getDatabase();
    const user = db.queryOne<UserRecord>('SELECT * FROM users WHERE id = ?', [userId]);

    // Workspaces
    const workspaces = WorkspaceService.listWorkspaces(userId);

    // Members across user's active workspaces
    const members = db.query<{
      id: string;
      user_id: string;
      email: string;
      role: 'owner' | 'admin' | 'member';
      status: 'active' | 'invited';
      workspace_id: string;
      joined_at: string;
    }>(
      `SELECT m.id, m.user_id, u.email, m.role, m.status, m.workspace_id, m.joined_at
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       JOIN memberships my_m ON my_m.workspace_id = m.workspace_id
       WHERE my_m.user_id = ? AND m.status = 'active'`,
      [userId]
    );

    const formattedMembers = members.map((m) => {
      const namePart = m.email.split('@')[0].replace(/[._]/g, ' ');
      const name = namePart.replace(/\b\w/g, (c) => c.toUpperCase());
      const initials = name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      return {
        id: m.user_id,
        name,
        email: m.email,
        initials: initials || 'TM',
        role: m.role,
        workspaceId: m.workspace_id,
        itemAccessCount: m.role === 'owner' ? ('All items' as const) : 1,
        avatarBg: '#EDE9FE',
        status: m.status,
        joinedAt: m.joined_at,
      };
    });

    // Encrypted Items across user's workspaces
    const items = db.query<{
      id: string;
      workspace_id: string;
      collection_id: string | null;
      type: string;
      payload_enc: string;
      nonce: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT i.* FROM items i
       JOIN memberships m ON m.workspace_id = i.workspace_id
       WHERE m.user_id = ? AND i.deleted_at IS NULL`,
      [userId]
    );

    const formattedItems = items.map((i) => {
      // Decode or format item for client view
      return {
        id: i.id,
        serviceName: 'Encrypted Service',
        serviceIcon: 'custom' as const,
        iconBg: '#4F46E5',
        iconInitials: 'ES',
        domain: 'vaultshare.internal',
        url: 'https://vaultshare.internal',
        username: 'encrypted_user',
        password: '[Client-Side Encrypted - Requires Vault Passphrase Unlock]',
        notes: 'Payload is stored as authenticated AEAD ciphertext on server.',
        workspaceId: i.workspace_id,
        folder: 'General',
        tags: ['secure', 'encrypted'],
        isFavorite: false,
        lastUsedAt: 'Just now',
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        sharedWith: [],
        payloadEnc: i.payload_enc,
        nonce: i.nonce,
      };
    });

    // Audit Events
    const auditRows = db.query<{
      id: string;
      created_at: string;
      action: string;
      outcome: 'OK' | 'Denied';
      details: string | null;
      email: string | null;
    }>(
      `SELECT a.*, u.email
       FROM audit_events a
       LEFT JOIN users u ON u.id = a.actor_user_id
       ORDER BY a.created_at DESC LIMIT 50`
    );

    const formattedAudit = auditRows.map((a) => ({
      id: a.id,
      timestamp: a.created_at,
      actorName: a.email ? a.email.split('@')[0] : 'System',
      actorEmail: a.email || 'system@vaultshare.internal',
      action: a.action,
      target: 'Workspace',
      outcome: a.outcome,
      details: a.details || 'Security action logged.',
    }));

    // Rotation Tasks
    const rotationRows = db.query<{
      id: string;
      item_id: string;
      workspace_id: string;
      triggered_by: string;
      status: string;
      completed_at: string | null;
    }>(`SELECT * FROM rotation_tasks ORDER BY created_at DESC`);

    const formattedRotation = rotationRows.map((r) => ({
      id: r.id,
      itemId: r.item_id,
      serviceName: 'Credential Item',
      workspaceName: 'Team Workspace',
      triggeredBy: r.triggered_by,
      isDone: r.status === 'done',
      completedAt: r.completed_at || undefined,
    }));

    return {
      currentUser: user
        ? {
            id: user.id,
            name: user.email.split('@')[0],
            email: user.email,
            initials: user.email.slice(0, 2).toUpperCase(),
            role: 'owner' as const,
            avatarBg: '#EDE9FE',
          }
        : null,
      workspaces,
      members: formattedMembers,
      items: formattedItems,
      auditEvents: formattedAudit,
      rotationTasks: formattedRotation,
    };
  }
}
