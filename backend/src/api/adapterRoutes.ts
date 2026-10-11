import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { FrontendMockAdapter } from '../adapters/frontendMockAdapter.ts';
import { requireAuth } from '../auth/authMiddleware.ts';

export const adapterRouter = Router();

// GET /adapter/state (returns full state structured matching phase 2/src/types/vault.ts)
adapterRouter.get('/adapter/state', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = FrontendMockAdapter.getState(req.user!.id);
    res.status(200).json(state);
  } catch (err) {
    next(err);
  }
});
