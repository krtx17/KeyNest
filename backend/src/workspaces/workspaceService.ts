import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { hashToken } from '../auth/cryptoUtils.ts';

export type WorkspaceKind = 'personal' | 'team';
export type MemberRole = 'owner' | 'admin' | 'member';
export type MemberStatus = 'invited' | 'active' | 'suspended' | 'removed';

export interface WorkspaceRecord {
  id: string;
  name: string;
  kind: WorkspaceKind;
  owner_id: string;
  color: string;
  description: string | null;
  key_version: number;
  created_at: string;
  deleted_at: string | null;
}

export interface MembershipRecord {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  removed_at: string | null;
}

export interface InvitationRecord {
  id: string;
  workspace_id: string;
  invitee_email: string;
  role: MemberRole;
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  invited_by: string;
}

export class WorkspaceService {
  /**
   * Retrieves all active workspaces for a user with membership counts and item counts.
   */
  static listWorkspaces(userId: string) {
    const db = getDatabase();
    const rows = db.query<{
      id: string;
      name: string;
      kind: WorkspaceKind;
      owner_id: string;
      color: string;
      description: string | null;
      key_version: number;
      created_at: string;
      role: MemberRole;
      members_count: number;
      logins_count: number;
    }>(
      `SELECT w.*, m.role,
         (SELECT COUNT(*) FROM memberships m2 WHERE m2.workspace_id = w.id AND m2.status = 'active') as members_count,
         (SELECT COUNT(*) FROM items i WHERE i.workspace_id = w.id AND i.deleted_at IS NULL) as logins_count
       FROM workspaces w
       JOIN memberships m ON m.workspace_id = w.id
       WHERE m.user_id = ? AND m.status = 'active' AND w.deleted_at IS NULL
       ORDER BY w.created_at ASC`,
      [userId]
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      ownerId: r.owner_id,
      color: r.color,
      description: r.description,
      keyVersion: r.key_version,
      membersCount: Number(r.members_count),
      loginsCount: Number(r.logins_count),
      role: r.role,
    }));
  }

  /**
   * Retrieves workspace details and members.
   */
  static getWorkspace(userId: string, workspaceId: string) {
    const db = getDatabase();
    const membership = db.queryOne<MembershipRecord>(
      `SELECT * FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'`,
      [workspaceId, userId]
    );

    if (!membership) {
      throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found or access denied.');
    }

    const ws = db.queryOne<WorkspaceRecord>(
      `SELECT * FROM workspaces WHERE id = ? AND deleted_at IS NULL`,
      [workspaceId]
    );

    if (!ws) {
      throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.');
    }

    const members = db.query<{
      id: string;
      user_id: string;
      email: string;
      role: MemberRole;
      status: MemberStatus;
      joined_at: string;
    }>(
      `SELECT m.id, m.user_id, u.email, m.role, m.status, m.joined_at
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = ? AND m.status = 'active'`,
      [workspaceId]
    );

    return {
      workspace: {
        id: ws.id,
        name: ws.name,
        kind: ws.kind,
        ownerId: ws.owner_id,
        color: ws.color,
        description: ws.description,
        keyVersion: ws.key_version,
        role: membership.role,
      },
      members: members.map((m) => ({
        id: m.user_id,
        membershipId: m.id,
        email: m.email,
        role: m.role,
        status: m.status,
        joinedAt: m.joined_at,
      })),
    };
  }

  /**
   * Creates a new team workspace.
   */
  static createWorkspace(params: {
    userId: string;
    name: string;
    description?: string;
    color?: string;
  }) {
    const db = getDatabase();
    const wsId = 'ws_' + crypto.randomUUID();
    const now = new Date().toISOString();

    db.execute(
      `INSERT INTO workspaces (id, name, kind, owner_id, color, description, key_version, created_at)
       VALUES (?, ?, 'team', ?, ?, ?, 1, ?)`,
      [wsId, params.name, params.userId, params.color || '#0D9488', params.description || null, now]
    );

    const memId = 'mem_' + crypto.randomUUID();
    db.execute(
      `INSERT INTO memberships (id, workspace_id, user_id, role, status, joined_at)
       VALUES (?, ?, ?, 'owner', 'active', ?)`,
      [memId, wsId, params.userId, now]
    );

    return {
      id: wsId,
      name: params.name,
      kind: 'team' as const,
      ownerId: params.userId,
      color: params.color || '#0D9488',
      description: params.description || null,
      keyVersion: 1,
      membersCount: 1,
      loginsCount: 0,
    };
  }

  /**
   * Creates an invitation to a workspace.
   */
  static createInvitation(params: {
    inviterId: string;
    workspaceId: string;
    inviteeEmail: string;
    role: MemberRole;
  }) {
    const db = getDatabase();
    const inviterMembership = db.queryOne<MembershipRecord>(
      `SELECT * FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'`,
      [params.workspaceId, params.inviterId]
    );

    if (!inviterMembership || (inviterMembership.role !== 'owner' && inviterMembership.role !== 'admin')) {
      throw new AppError(403, 'FORBIDDEN', 'Only owners and admins can invite members.');
    }

    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = hashToken(token);
    const inviteId = 'inv_' + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    db.execute(
      `INSERT INTO invitations (id, workspace_id, invitee_email, role, token_hash, expires_at, invited_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        inviteId,
        params.workspaceId,
        params.inviteeEmail.toLowerCase().trim(),
        params.role,
        tokenHash,
        expiresAt,
        params.inviterId,
      ]
    );

    return {
      invitationId: inviteId,
      workspaceId: params.workspaceId,
      inviteeEmail: params.inviteeEmail.toLowerCase().trim(),
      role: params.role,
      token, // Single-use invitation token returned to inviter
      expiresAt,
    };
  }

  /**
   * Accepts an invitation using token.
   */
  static acceptInvitation(userId: string, token: string) {
    const db = getDatabase();
    const tokenHash = hashToken(token);
    const invite = db.queryOne<InvitationRecord>(
      `SELECT * FROM invitations WHERE token_hash = ? AND accepted_at IS NULL AND revoked_at IS NULL`,
      [tokenHash]
    );

    if (!invite) {
      throw new AppError(404, 'INVALID_INVITATION', 'Invitation is invalid or has already been used.');
    }

    if (new Date(invite.expires_at) < new Date()) {
      throw new AppError(410, 'INVITATION_EXPIRED', 'Invitation has expired.');
    }

    const now = new Date().toISOString();

    // Check if user is already a member
    const existing = db.queryOne<MembershipRecord>(
      `SELECT * FROM memberships WHERE workspace_id = ? AND user_id = ?`,
      [invite.workspace_id, userId]
    );

    if (existing) {
      if (existing.status === 'active') {
        throw new AppError(400, 'ALREADY_MEMBER', 'You are already a member of this workspace.');
      }
      // Re-activate member
      db.execute(
        `UPDATE memberships SET status = 'active', role = ?, joined_at = ?, removed_at = NULL WHERE id = ?`,
        [invite.role, now, existing.id]
      );
    } else {
      const memId = 'mem_' + crypto.randomUUID();
      db.execute(
        `INSERT INTO memberships (id, workspace_id, user_id, role, status, joined_at)
         VALUES (?, ?, ?, ?, 'active', ?)`,
        [memId, invite.workspace_id, userId, invite.role, now]
      );
    }

    // Mark invitation accepted
    db.execute(`UPDATE invitations SET accepted_at = ? WHERE id = ?`, [now, invite.id]);

    return {
      accepted: true,
      workspaceId: invite.workspace_id,
      role: invite.role,
    };
  }

  /**
   * Updates a member's role.
   */
  static updateMemberRole(params: {
    actorId: string;
    workspaceId: string;
    targetUserId: string;
    newRole: MemberRole;
  }) {
    const db = getDatabase();
    const actorMem = db.queryOne<MembershipRecord>(
      `SELECT * FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'`,
      [params.workspaceId, params.actorId]
    );

    if (!actorMem || (actorMem.role !== 'owner' && actorMem.role !== 'admin')) {
      throw new AppError(403, 'FORBIDDEN', 'Only workspace owners or admins can modify member roles.');
    }

    if (params.newRole === 'owner') {
      throw new AppError(400, 'INVALID_ROLE_CHANGE', 'Use transfer ownership to assign owner role.');
    }

    const targetMem = db.queryOne<MembershipRecord>(
      `SELECT * FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'`,
      [params.workspaceId, params.targetUserId]
    );

    if (!targetMem) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Target member not found.');
    }

    if (targetMem.role === 'owner') {
      throw new AppError(403, 'FORBIDDEN', 'Cannot alter owner role directly.');
    }

    db.execute(`UPDATE memberships SET role = ? WHERE id = ?`, [params.newRole, targetMem.id]);

    return {
      updated: true,
      workspaceId: params.workspaceId,
      userId: params.targetUserId,
      newRole: params.newRole,
    };
  }

  /**
   * Transfers ownership of a team workspace.
   */
  static transferOwnership(params: {
    currentOwnerId: string;
    workspaceId: string;
    newOwnerId: string;
  }) {
    const db = getDatabase();
    const ws = db.queryOne<WorkspaceRecord>(`SELECT * FROM workspaces WHERE id = ?`, [params.workspaceId]);
    if (!ws) {
      throw new AppError(404, 'WORKSPACE_NOT_FOUND', 'Workspace not found.');
    }

    if (ws.owner_id !== params.currentOwnerId) {
      throw new AppError(403, 'FORBIDDEN', 'Only current owner can transfer workspace ownership.');
    }

    const targetMem = db.queryOne<MembershipRecord>(
      `SELECT * FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'`,
      [params.workspaceId, params.newOwnerId]
    );

    if (!targetMem) {
      throw new AppError(404, 'TARGET_NOT_MEMBER', 'New owner must be an active member of the workspace.');
    }

    // Demote current owner to admin, promote new owner
    db.execute(`UPDATE workspaces SET owner_id = ? WHERE id = ?`, [params.newOwnerId, params.workspaceId]);
    db.execute(`UPDATE memberships SET role = 'owner' WHERE id = ?`, [targetMem.id]);
    db.execute(
      `UPDATE memberships SET role = 'admin' WHERE workspace_id = ? AND user_id = ?`,
      [params.workspaceId, params.currentOwnerId]
    );

    return {
      transferred: true,
      workspaceId: params.workspaceId,
      newOwnerId: params.newOwnerId,
    };
  }
}
