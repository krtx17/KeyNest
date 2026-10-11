import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SharingService } from '../sharing/sharingService.ts';
import { AuditService } from '../audit/auditService.ts';
import { requireAuth, requireStepUp } from '../auth/authMiddleware.ts';
import { requireWorkspaceRole } from '../workspaces/workspaceMiddleware.ts';

export const sharingRouter = Router();

const shareItemSchema = z.object({
  recipientUserId: z.string().min(1),
  wrappedKey: z.string().min(1),
  permission: z.enum(['view_copy', 'edit']).default('view_copy'),
});

const toggleTaskSchema = z.object({
  isDone: z.boolean(),
});

// POST /items/:id/shares (requires Step-Up)
sharingRouter.post(
  '/items/:id/shares',
  requireAuth,
  requireStepUp,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = shareItemSchema.parse(req.body);
      const result = SharingService.shareItem({
        actorId: req.user!.id,
        itemId: req.params.id,
        ...parsed,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /items/:id/shares/:uid (requires Step-Up)
sharingRouter.delete(
  '/items/:id/shares/:uid',
  requireAuth,
  requireStepUp,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = SharingService.revokeShare({
        actorId: req.user!.id,
        itemId: req.params.id,
        recipientUserId: req.params.uid,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /workspaces/:id/members/:uid (Offboard member - requires Admin/Owner + Step-Up)
sharingRouter.delete(
  '/workspaces/:id/members/:uid',
  requireAuth,
  requireWorkspaceRole('admin'),
  requireStepUp,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = SharingService.offboardMember({
        actorId: req.user!.id,
        workspaceId: req.params.id,
        targetUserId: req.params.uid,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /workspaces/:id/rotation-tasks
sharingRouter.get(
  '/workspaces/:id/rotation-tasks',
  requireAuth,
  requireWorkspaceRole('member'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const tasks = SharingService.getRotationTasks(req.user!.id, req.params.id);
      res.status(200).json({ tasks });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /rotation-tasks/:id
sharingRouter.patch(
  '/rotation-tasks/:id',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isDone } = toggleTaskSchema.parse(req.body);
      const result = SharingService.toggleRotationTask(req.params.id, isDone);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /workspaces/:id/audit
sharingRouter.get(
  '/workspaces/:id/audit',
  requireAuth,
  requireWorkspaceRole('member'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
      const events = AuditService.getWorkspaceAudit(req.params.id, limit, offset);
      res.status(200).json({ events });
    } catch (err) {
      next(err);
    }
  }
);
