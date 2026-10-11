import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { AccountService } from '../account/accountService.ts';
import { requireAuth, requireStepUp } from '../auth/authMiddleware.ts';

export const accountRouter = Router();

// POST /account/export (requires Step-Up)
accountRouter.post(
  '/account/export',
  requireAuth,
  requireStepUp,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = AccountService.exportVault(req.user!.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /account (requires Step-Up)
accountRouter.delete(
  '/account',
  requireAuth,
  requireStepUp,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = AccountService.deleteAccount(req.user!.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);
