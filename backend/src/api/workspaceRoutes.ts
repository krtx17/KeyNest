import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { WorkspaceService } from '../workspaces/workspaceService.ts';
import { requireAuth, requireStepUp } from '../auth/authMiddleware.ts';
import { requireWorkspaceRole } from '../workspaces/workspaceMiddleware.ts';

export const workspaceRouter = Router();

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

const transferOwnerSchema = z.object({
  newOwnerId: z.string().min(1),
});

// GET /workspaces
workspaceRouter.get('/workspaces', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaces = WorkspaceService.listWorkspaces(req.user!.id);
    res.status(200).json({ workspaces });
  } catch (err) {
    next(err);
  }
});

// POST /workspaces
workspaceRouter.post('/workspaces', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createWorkspaceSchema.parse(req.body);
    const result = WorkspaceService.createWorkspace({
      userId: req.user!.id,
      ...parsed,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /workspaces/:id
workspaceRouter.get(
  '/workspaces/:id',
  requireAuth,
  requireWorkspaceRole('member'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = WorkspaceService.getWorkspace(req.user!.id, req.params.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /workspaces/:id/invites (Admin/Owner only)
workspaceRouter.post(
  '/workspaces/:id/invites',
  requireAuth,
  requireWorkspaceRole('admin'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, role } = inviteSchema.parse(req.body);
      const result = WorkspaceService.createInvitation({
        inviterId: req.user!.id,
        workspaceId: req.params.id,
        inviteeEmail: email,
        role,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /invites/accept
workspaceRouter.post('/invites/accept', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = acceptInviteSchema.parse(req.body);
    const result = WorkspaceService.acceptInvitation(req.user!.id, token);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /workspaces/:id/members/:uid (Admin/Owner + Step-up)
workspaceRouter.patch(
  '/workspaces/:id/members/:uid',
  requireAuth,
  requireWorkspaceRole('admin'),
  requireStepUp,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role } = updateRoleSchema.parse(req.body);
      const result = WorkspaceService.updateMemberRole({
        actorId: req.user!.id,
        workspaceId: req.params.id,
        targetUserId: req.params.uid,
        newRole: role,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /workspaces/:id/transfer-owner (Owner + Step-up)
workspaceRouter.post(
  '/workspaces/:id/transfer-owner',
  requireAuth,
  requireWorkspaceRole('owner'),
  requireStepUp,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { newOwnerId } = transferOwnerSchema.parse(req.body);
      const result = WorkspaceService.transferOwnership({
        currentOwnerId: req.user!.id,
        workspaceId: req.params.id,
        newOwnerId,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);
