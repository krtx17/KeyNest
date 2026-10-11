import type { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/connection.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type { MemberRole, MembershipRecord } from './workspaceService.ts';

declare global {
  namespace Express {
    interface Request {
      workspaceMembership?: MembershipRecord;
    }
  }
}

const ROLE_RANK: Record<MemberRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

export function requireWorkspaceRole(minRole: MemberRole = 'member') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
    }

    const workspaceId =
      req.params.workspaceId || req.params.id || req.body?.workspaceId || req.query?.workspaceId;

    if (!workspaceId) {
      return next(new AppError(400, 'BAD_REQUEST', 'Workspace ID required.'));
    }

    const db = getDatabase();
    const membership = db.queryOne<MembershipRecord>(
      `SELECT * FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'`,
      [workspaceId, req.user.id]
    );

    if (!membership) {
      return next(
        new AppError(403, 'FORBIDDEN', 'You do not have access to this workspace.')
      );
    }

    if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
      return next(
        new AppError(
          403,
          'INSUFFICIENT_PERMISSIONS',
          `This action requires ${minRole} permissions in this workspace.`
        )
      );
    }

    req.workspaceMembership = membership;
    next();
  };
}
