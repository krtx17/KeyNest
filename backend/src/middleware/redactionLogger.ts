import type { Request, Response, NextFunction } from 'express';

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'payload_enc',
  'wrapped_key',
  'key_bundle',
  'recovery_bundle',
  'recovery_key',
  'passphrase',
  'totp_secret',
  'totp_secret_enc',
  'credential_id',
  'private_key',
]);

/**
 * Recursively redacts sensitive values from any object, array, or primitive.
 */
export function redactSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Check if string contains bearer token or authorization header
    if (/^bearer\s+/i.test(data)) {
      return 'Bearer [REDACTED]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  if (typeof data === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  return data;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class RedactedLogger {
  private formatLog(level: LogLevel, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    const redactedMeta = meta ? redactSensitiveData(meta) : undefined;
    const metaStr = redactedMeta ? ` | ${JSON.stringify(redactedMeta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  info(message: string, meta?: unknown) {
    console.log(this.formatLog('info', message, meta));
  }

  warn(message: string, meta?: unknown) {
    console.warn(this.formatLog('warn', message, meta));
  }

  error(message: string, meta?: unknown) {
    console.error(this.formatLog('error', message, meta));
  }

  debug(message: string, meta?: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog('debug', message, meta));
    }
  }
}

export const logger = new RedactedLogger();

/**
 * Express middleware for logging incoming requests and response status with zero secret leakage.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, url, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`HTTP ${method} ${url} ${res.statusCode} (${duration}ms)`, {
      ip,
      statusCode: res.statusCode,
      query: req.query,
      body: req.body,
    });
  });

  next();
}
