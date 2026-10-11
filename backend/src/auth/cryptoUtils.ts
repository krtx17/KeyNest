import crypto from 'node:crypto';

/**
 * Standard password hashing using scrypt with unique 16-byte random salts.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  });
  return `scrypt:N=16384,r=8,p=1:${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 4 || parts[0] !== 'scrypt') {
      return false;
    }
    const salt = parts[2];
    const originalHash = Buffer.from(parts[3], 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024,
    });
    return crypto.timingSafeEqual(originalHash, derivedKey);
  } catch {
    return false;
  }
}

/**
 * TOTP RFC 6238 implementation using HMAC-SHA1.
 */
export function generateTotpSecret(): string {
  return crypto.randomBytes(20).toString('hex');
}

export function generateTotpCode(secretHex: string, timeStepWindow: number = 0): string {
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30) + timeStepWindow;
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac('sha1', Buffer.from(secretHex, 'hex'));
  hmac.update(timeBuffer);
  const digest = hmac.digest();

  // Dynamic truncation
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export function verifyTotpCode(secretHex: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  // Check current window and +/- 1 window for clock drift
  for (let window = -1; window <= 1; window++) {
    const expected = generateTotpCode(secretHex, window);
    if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

/**
 * Cryptographic Tokens (Access & Refresh)
 */
export interface TokenPayload {
  userId: string;
  sessionId: string;
  deviceId: string;
  email: string;
  exp: number;
  iat: number;
}

function base64UrlEncode(data: Buffer | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return buf.toString('base64url');
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf-8');
}

export function signAccessToken(
  payload: Omit<TokenPayload, 'exp' | 'iat'>,
  secret: string,
  expiresInSeconds: number = 900 // 15 mins
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();

  return `${headerB64}.${payloadB64}.${base64UrlEncode(signature)}`;
}

export function verifyAccessToken(token: string, secret: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest();

    const actualSignature = Buffer.from(signatureB64, 'base64url');
    if (expectedSignature.length !== actualSignature.length || !crypto.timingSafeEqual(expectedSignature, actualSignature)) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadB64)) as TokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
