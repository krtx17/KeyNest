import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/authService.ts';
import { requireAuth, requireStepUp } from '../auth/authMiddleware.ts';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  kdfParams: z.record(z.unknown()).optional(),
  keyBundle: z.string().optional(),
  recoveryBundle: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().optional(),
  deviceName: z.string().min(1).default('Web Browser'),
  identityPublicKey: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const stepUpSchema = z.object({
  totpCode: z.string().optional(),
  passkeyVerified: z.boolean().optional(),
});

// POST /auth/register
authRouter.post('/auth/register', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const result = AuthService.register(parsed);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /auth/login
authRouter.post('/auth/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const result = AuthService.login({
      ...parsed,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /auth/refresh
authRouter.post('/auth/refresh', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = AuthService.refresh(refreshToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
authRouter.post('/auth/logout', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.session) {
      AuthService.logout(req.session.id);
    }
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /auth/setup-totp
authRouter.post('/auth/setup-totp', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = AuthService.setupTotp(req.user!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /auth/step-up
authRouter.post('/auth/step-up', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = stepUpSchema.parse(req.body);
    const result = AuthService.stepUp(req.session!.id, parsed);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /devices
authRouter.get('/devices', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  try {
    const devices = AuthService.getDevices(req.user!.id);
    res.status(200).json({ devices });
  } catch (err) {
    next(err);
  }
});

// POST /devices/:id/revoke (requires step-up)
authRouter.post('/devices/:id/revoke', requireAuth, requireStepUp, (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = AuthService.revokeDevice(req.user!.id, req.params.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /sessions/sign-out-others (requires step-up)
authRouter.post('/sessions/sign-out-others', requireAuth, requireStepUp, (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = AuthService.signOutOtherDevices(req.user!.id, req.session!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
