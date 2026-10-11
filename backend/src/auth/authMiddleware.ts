import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './cryptoUtils.ts';
import type { TokenPayload } from './cryptoUtils.ts';
import { config } from '../config/index.ts';
import { getDatabase } from '../db/connection.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type { SessionRecord, UserRecord } from './authService.ts';

declare global {
  namespace Express {
    interface Request {
      user?: UserRecord;
      session?: SessionRecord;
      tokenPayload?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication token required.'));
  }

  const token = authHeader.substring(7).trim();
  const payload = verifyAccessToken(token, config.JWT_ACCESS_SECRET);
  if (!payload) {
    return next(new AppError(401, 'INVALID_TOKEN', 'Access token is invalid or expired.'));
  }

  const db = getDatabase();
  const session = db.queryOne<SessionRecord>(
    'SELECT * FROM sessions WHERE id = ? AND revoked_at IS NULL',
    [payload.sessionId]
  );

  if (!session) {
    return next(new AppError(401, 'SESSION_REVOKED', 'Session has been invalidated or revoked.'));
  }

  const user = db.queryOne<UserRecord>(
    "SELECT * FROM users WHERE id = ? AND status = 'active'",
    [payload.userId]
  );

  if (!user) {
    return next(new AppError(401, 'USER_DISABLED', 'User account is inactive or deleted.'));
  }

  req.tokenPayload = payload;
  req.session = session;
  req.user = user;
  next();
}

/**
 * Server-side step-up authentication guard.
 * Verifies that the session has recent elevation (elevated_until > now).
 */
export function requireStepUp(req: Request, _res: Response, next: NextFunction) {
  if (!req.session) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
  }

  if (!req.session.elevated_until) {
    return next(
      new AppError(
        403,
        'STEP_UP_REQUIRED',
        'This sensitive action requires step-up re-authentication (passkey or MFA).'
      )
    );
  }

  const elevatedUntil = new Date(req.session.elevated_until);
  if (elevatedUntil <= new Date()) {
    return next(
      new AppError(
        403,
        'STEP_UP_EXPIRED',
        'Step-up re-authentication has expired. Please re-authenticate.'
      )
    );
  }

  next();
}
