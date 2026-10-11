import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from './redactionLogger.ts';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    const firstIssue = err.issues[0];
    const message = firstIssue ? `${firstIssue.path.join('.') || 'input'}: ${firstIssue.message}` : 'Invalid input data.';
    logger.warn(`Validation error on ${req.method} ${req.url}: ${message}`);
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message,
      },
    });
  }

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = isAppError ? err.message : 'An unexpected error occurred.';

  // Securely log the internal error details with redaction
  logger.error(`Error processing ${req.method} ${req.url}: ${err.message}`, {
    stack: err.stack,
    details: isAppError ? err.details : undefined,
  });

  // Client receives a sanitized error shape
  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(process.env.NODE_ENV !== 'production' && isAppError && err.details ? { details: err.details } : {}),
    },
  });
}
