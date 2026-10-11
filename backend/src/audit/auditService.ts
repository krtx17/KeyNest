import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.ts';
import { hashToken } from '../auth/cryptoUtils.ts';
import { redactSensitiveData, logger } from '../middleware/redactionLogger.ts';

export interface AuditRecord {
  id: string;
  workspace_id: string | null;
  actor_user_id: string | null;
  actor_email?: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  outcome: 'OK' | 'Denied' | 'Error';
  details: string | null;
  ip_hash: string | null;
  created_at: string;
}

export class AuditService {
  /**
   * Logs a security audit event with guaranteed zero secret values.
   */
  static log(params: {
    workspaceId?: string;
    actorUserId?: string;
    action: string;
    targetType?: string;
    targetId?: string;
    outcome?: 'OK' | 'Denied' | 'Error';
    details?: string;
    ip?: string;
  }) {
    const db = getDatabase();
    const eventId = 'aud_' + crypto.randomUUID();
    const now = new Date().toISOString();
    const ipHash = params.ip ? hashToken(params.ip) : null;

    // Redact details if any sensitive patterns exist
    const sanitizedDetails = params.details
      ? typeof params.details === 'string'
        ? (redactSensitiveData({ d: params.details }) as { d: string }).d
        : JSON.stringify(redactSensitiveData(params.details))
      : null;

    db.execute(
      `INSERT INTO audit_events (id, workspace_id, actor_user_id, action, target_type, target_id, outcome, details, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        params.workspaceId || null,
        params.actorUserId || null,
        params.action,
        params.targetType || null,
        params.targetId || null,
        params.outcome || 'OK',
        sanitizedDetails,
        ipHash,
        now,
      ]
    );

    logger.info(`AUDIT EVENT: ${params.action} [${params.outcome || 'OK'}]`, {
      eventId,
      workspaceId: params.workspaceId,
      actorUserId: params.actorUserId,
    });

    return { id: eventId };
  }

  /**
   * Retrieves audit events for a workspace.
   */
  static getWorkspaceAudit(workspaceId: string, limit: number = 50, offset: number = 0) {
    const db = getDatabase();
    const rows = db.query<AuditRecord>(
      `SELECT a.*, u.email as actor_email
       FROM audit_events a
       LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE a.workspace_id = ?
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [workspaceId, limit, offset]
    );

    return rows.map((r) => ({
      id: r.id,
      timestamp: r.created_at,
      actorEmail: r.actor_email || 'System',
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      outcome: r.outcome,
      details: r.details,
    }));
  }
}
