import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.ts';
import { config } from '../config/index.ts';
import { AppError } from '../middleware/errorHandler.ts';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  hashToken,
  generateTotpSecret,
  verifyTotpCode,
} from './cryptoUtils.ts';
import { EmailService } from '../email/emailService.ts';

export interface UserRecord {
  id: string;
  email: string;
  email_verified_at: string | null;
  password_hash: string | null;
  kdf_params: string | null;
  key_bundle: string | null;
  recovery_bundle: string | null;
  status: 'active' | 'locked' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  device_id: string;
  refresh_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  elevated_until: string | null;
}

export interface DeviceRecord {
  id: string;
  user_id: string;
  name: string;
  identity_public_key: string | null;
  enrolled_by_device_id: string | null;
  revoked_at: string | null;
  last_seen_at: string;
}

export class AuthService {
  /**
   * Registers a new user, sets up their personal vault, and returns initial credentials.
   */
  static register(params: {
    email: string;
    password?: string;
    kdfParams?: Record<string, unknown>;
    keyBundle?: string;
    recoveryBundle?: string;
    deviceName?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const db = getDatabase();
    const normalizedEmail = params.email.toLowerCase().trim();
    const existing = db.queryOne<UserRecord>('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing) {
      throw new AppError(409, 'USER_EXISTS', 'An account with this email already exists.');
    }

    const userId = 'usr_' + crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = params.password ? hashPassword(params.password) : null;

    db.execute(
      `INSERT INTO users (id, email, email_verified_at, password_hash, kdf_params, key_bundle, recovery_bundle, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        userId,
        normalizedEmail,
        now, // auto-verified for MVP registration
        passwordHash,
        params.kdfParams ? JSON.stringify(params.kdfParams) : null,
        params.keyBundle || null,
        params.recoveryBundle || null,
        now,
        now,
      ]
    );

    // Auto-provision Personal Vault workspace for the user
    const workspaceId = 'ws_' + crypto.randomUUID();
    db.execute(
      `INSERT INTO workspaces (id, name, kind, owner_id, color, description, key_version, created_at)
       VALUES (?, 'Personal vault', 'personal', ?, '#6366F1', 'Private personal vault', 1, ?)`,
      [workspaceId, userId, now]
    );

    // Add membership as Owner
    const membershipId = 'mem_' + crypto.randomUUID();
    db.execute(
      `INSERT INTO memberships (id, workspace_id, user_id, role, status, joined_at)
       VALUES (?, ?, ?, 'owner', 'active', ?)`,
      [membershipId, workspaceId, userId, now]
    );

    // Enroll initial device
    const deviceName = params.deviceName || 'Web Browser';
    const deviceId = 'dev_' + crypto.randomUUID();
    db.execute(
      `INSERT INTO devices (id, user_id, name, identity_public_key, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
      [deviceId, userId, deviceName, null, now]
    );

    // Create initial session & tokens
    const sessionId = 'ses_' + crypto.randomUUID();
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    db.execute(
      `INSERT INTO sessions (id, user_id, device_id, refresh_token_hash, expires_at, ip_hash, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        userId,
        deviceId,
        refreshTokenHash,
        expiresAt,
        params.ip ? hashToken(params.ip) : null,
        params.userAgent || null,
      ]
    );

    const accessToken = signAccessToken(
      {
        userId,
        sessionId,
        deviceId,
        email: normalizedEmail,
      },
      config.JWT_ACCESS_SECRET
    );

    return {
      userId,
      email: normalizedEmail,
      personalWorkspaceId: workspaceId,
      user: {
        id: userId,
        email: normalizedEmail,
        kdfParams: params.kdfParams || null,
        keyBundle: params.keyBundle || null,
        recoveryBundle: params.recoveryBundle || null,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900,
      },
      device: {
        id: deviceId,
        name: deviceName,
      },
    };
  }

  /**
   * Authenticates user, enrolls/updates device, and returns token pair.
   */
  static login(params: {
    email: string;
    password?: string;
    deviceName: string;
    identityPublicKey?: string;
    ip?: string;
    userAgent?: string;
  }) {
    const db = getDatabase();
    const user = db.queryOne<UserRecord>('SELECT * FROM users WHERE email = ?', [params.email.toLowerCase().trim()]);

    if (!user || user.status !== 'active') {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (user.password_hash) {
      if (!params.password || !verifyPassword(params.password, user.password_hash)) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
      }
    } else {
      if (!params.identityPublicKey) {
        throw new AppError(401, 'MISSING_CREDENTIALS', 'Authentication credential required.');
      }
    }

    const now = new Date().toISOString();

    // Enroll or update device
    const deviceId = 'dev_' + crypto.randomUUID();
    db.execute(
      `INSERT INTO devices (id, user_id, name, identity_public_key, last_seen_at)
       VALUES (?, ?, ?, ?, ?)`,
      [deviceId, user.id, params.deviceName, params.identityPublicKey || null, now]
    );

    // Create session
    const sessionId = 'ses_' + crypto.randomUUID();
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    const ipHash = params.ip ? hashToken(params.ip) : null;

    db.execute(
      `INSERT INTO sessions (id, user_id, device_id, refresh_token_hash, expires_at, ip_hash, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, user.id, deviceId, refreshTokenHash, expiresAt, ipHash, params.userAgent || null]
    );

    const accessToken = signAccessToken(
      {
        userId: user.id,
        sessionId,
        deviceId,
        email: user.email,
      },
      config.JWT_ACCESS_SECRET
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        kdfParams: user.kdf_params ? JSON.parse(user.kdf_params) : null,
        keyBundle: user.key_bundle,
        recoveryBundle: user.recovery_bundle,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900,
      },
      device: {
        id: deviceId,
        name: params.deviceName,
      },
    };
  }

  /**
   * Refreshes access token and rotates refresh token.
   */
  static refresh(refreshToken: string) {
    const db = getDatabase();
    const hashed = hashToken(refreshToken);
    const session = db.queryOne<SessionRecord>(
      'SELECT * FROM sessions WHERE refresh_token_hash = ?',
      [hashed]
    );

    if (!session) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Session expired or invalidated.');
    }

    // Check device revocation first for accurate client feedback
    if (session.device_id) {
      const device = db.queryOne<DeviceRecord>('SELECT * FROM devices WHERE id = ?', [session.device_id]);
      if (device?.revoked_at) {
        throw new AppError(401, 'DEVICE_REVOKED', 'Device has been revoked.');
      }
    }

    if (session.revoked_at) {
      throw new AppError(401, 'SESSION_REVOKED', 'Session has been revoked.');
    }

    const now = new Date();
    if (new Date(session.expires_at) < now) {
      throw new AppError(401, 'SESSION_EXPIRED', 'Session has expired.');
    }

    const user = db.queryOne<UserRecord>('SELECT * FROM users WHERE id = ?', [session.user_id]);
    if (!user || user.status !== 'active') {
      throw new AppError(401, 'ACCOUNT_DISABLED', 'Account is disabled.');
    }

    // Check device revocation
    if (session.device_id) {
      const device = db.queryOne<DeviceRecord>('SELECT * FROM devices WHERE id = ?', [session.device_id]);
      if (device?.revoked_at) {
        throw new AppError(401, 'DEVICE_REVOKED', 'Device has been revoked.');
      }
    }

    // Rotate refresh token
    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashToken(newRefreshToken);

    db.execute('UPDATE sessions SET refresh_token_hash = ? WHERE id = ?', [newRefreshTokenHash, session.id]);

    const accessToken = signAccessToken(
      {
        userId: user.id,
        sessionId: session.id,
        deviceId: session.device_id,
        email: user.email,
      },
      config.JWT_ACCESS_SECRET
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    };
  }

  /**
   * Revokes a session (Logout).
   */
  static logout(sessionId: string) {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.execute('UPDATE sessions SET revoked_at = ? WHERE id = ?', [now, sessionId]);
  }

  /**
   * Elevates a session via TOTP code or passkey assertion.
   */
  static stepUp(sessionId: string, params: { totpCode?: string; passkeyVerified?: boolean }) {
    const db = getDatabase();
    const session = db.queryOne<SessionRecord>('SELECT * FROM sessions WHERE id = ? AND revoked_at IS NULL', [sessionId]);
    if (!session) {
      throw new AppError(401, 'INVALID_SESSION', 'Session invalid.');
    }

    let isVerified = false;

    if (params.passkeyVerified) {
      // Passkey assertion verified
      isVerified = true;
    } else if (params.totpCode) {
      const totpCred = db.queryOne<{ totp_secret_enc: string }>(
        "SELECT totp_secret_enc FROM auth_credentials WHERE user_id = ? AND type = 'totp'",
        [session.user_id]
      );
      if (totpCred && totpCred.totp_secret_enc) {
        isVerified = verifyTotpCode(totpCred.totp_secret_enc, params.totpCode);
      }
    }

    if (!isVerified) {
      throw new AppError(400, 'STEP_UP_FAILED', 'Invalid step-up verification credentials.');
    }

    const elevatedUntil = new Date(Date.now() + config.STEP_UP_TTL_SECONDS * 1000).toISOString();
    db.execute('UPDATE sessions SET elevated_until = ? WHERE id = ?', [elevatedUntil, sessionId]);

    return {
      elevated: true,
      elevatedUntil,
    };
  }

  /**
   * Sets up TOTP secret for user.
   */
  static setupTotp(userId: string) {
    const db = getDatabase();
    const secret = generateTotpSecret();
    const credId = 'cred_' + crypto.randomUUID();

    // Check existing
    db.execute("DELETE FROM auth_credentials WHERE user_id = ? AND type = 'totp'", [userId]);
    db.execute(
      `INSERT INTO auth_credentials (id, user_id, type, totp_secret_enc)
       VALUES (?, ?, 'totp', ?)`,
      [credId, userId, secret]
    );

    return {
      secret,
    };
  }

  /**
   * Fetches enrolled devices for a user.
   */
  static getDevices(userId: string) {
    const db = getDatabase();
    return db.query<DeviceRecord>(
      'SELECT id, name, enrolled_by_device_id, revoked_at, last_seen_at FROM devices WHERE user_id = ? ORDER BY last_seen_at DESC',
      [userId]
    );
  }

  /**
   * Revokes an enrolled device and invalidates all associated sessions.
   */
  static revokeDevice(userId: string, deviceId: string) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const device = db.queryOne<DeviceRecord>('SELECT * FROM devices WHERE id = ? AND user_id = ?', [deviceId, userId]);
    if (!device) {
      throw new AppError(404, 'DEVICE_NOT_FOUND', 'Device not found.');
    }

    db.execute('UPDATE devices SET revoked_at = ? WHERE id = ?', [now, deviceId]);
    db.execute('UPDATE sessions SET revoked_at = ? WHERE device_id = ?', [now, deviceId]);

    return {
      revoked: true,
      deviceId,
    };
  }

  /**
   * Revokes all other sessions for a user except the current one.
   */
  static signOutOtherDevices(userId: string, currentSessionId: string) {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.execute(
      'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ? AND revoked_at IS NULL',
      [now, userId, currentSessionId]
    );
    return {
      revokedOthers: true,
    };
  }

  /**
   * Initiates a password reset request.
   * Sends a single-use expiring reset link to verified email.
   * Rate-limits requests and does not reveal whether the email exists.
   */
  static async requestPasswordReset(params: { email: string; ip?: string }): Promise<{ success: boolean; message: string }> {
    if (!EmailService.isConfigured()) {
      throw new AppError(
        503,
        'EMAIL_DELIVERY_NOT_CONFIGURED',
        'Email delivery is not configured on the server. Please configure an email provider (such as RESEND_API_KEY) in the environment settings to send reset links.'
      );
    }

    const db = getDatabase();
    const normalizedEmail = params.email.toLowerCase().trim();
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60 * 1000).toISOString(); // 15 mins window

    // Check rate limit: max 3 attempts per 15 minutes for the email
    const recentRequests = db.query<{ id: string }>(
      'SELECT id FROM password_resets WHERE email = ? AND created_at > ?',
      [normalizedEmail, windowStart]
    );

    if (recentRequests.length >= 3) {
      throw new AppError(
        429,
        'RATE_LIMIT_EXCEEDED',
        'Too many password reset requests. Please wait a few minutes before trying again.'
      );
    }

    const genericMessage = 'If an account exists for this email address, a password reset link has been sent.';

    // Look up user
    const user = db.queryOne<UserRecord>('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    if (!user || user.status !== 'active') {
      // Do not reveal whether user exists
      return { success: true, message: genericMessage };
    }

    // Generate cryptographically secure random token (64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(resetToken);
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // 30 minutes
    const resetId = 'pr_' + crypto.randomUUID();

    db.execute(
      `INSERT INTO password_resets (id, user_id, email, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [resetId, user.id, normalizedEmail, tokenHash, expiresAt, now.toISOString()]
    );

    await EmailService.sendPasswordResetLink({
      recipientEmail: user.email,
      resetToken,
      expiresAt,
    });

    return {
      success: true,
      message: genericMessage,
    };
  }

  /**
   * Verifies whether a password reset token is valid and unexpired.
   */
  static verifyPasswordResetToken(token: string) {
    const db = getDatabase();
    const tokenHash = hashToken(token);
    const record = db.queryOne<{
      id: string;
      user_id: string;
      email: string;
      token_hash: string;
      expires_at: string;
      used_at: string | null;
      created_at: string;
    }>('SELECT * FROM password_resets WHERE token_hash = ?', [tokenHash]);

    if (!record || record.used_at) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'This password reset link is invalid or has already been used.');
    }

    if (new Date(record.expires_at) < new Date()) {
      throw new AppError(400, 'EXPIRED_RESET_TOKEN', 'This password reset link has expired. Please request a new link.');
    }

    const user = db.queryOne<UserRecord>('SELECT email FROM users WHERE id = ?', [record.user_id]);
    return {
      valid: true,
      email: user ? user.email : record.email,
    };
  }

  /**
   * Resets the user's sign-in password using a verified single-use token.
   * Revokes all active sessions so all devices must sign in again.
   * Sends security notification email.
   */
  static async completePasswordReset(params: { token: string; newPassword: string }) {
    if (!params.newPassword || params.newPassword.length < 8) {
      throw new AppError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters long.');
    }

    const db = getDatabase();
    const tokenHash = hashToken(params.token);
    const record = db.queryOne<{
      id: string;
      user_id: string;
      email: string;
      token_hash: string;
      expires_at: string;
      used_at: string | null;
      created_at: string;
    }>('SELECT * FROM password_resets WHERE token_hash = ?', [tokenHash]);

    if (!record || record.used_at) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'This password reset link is invalid or has already been used.');
    }

    if (new Date(record.expires_at) < new Date()) {
      throw new AppError(400, 'EXPIRED_RESET_TOKEN', 'This password reset link has expired. Please request a new link.');
    }

    const user = db.queryOne<UserRecord>('SELECT * FROM users WHERE id = ?', [record.user_id]);
    if (!user || user.status !== 'active') {
      throw new AppError(400, 'INVALID_USER', 'The user account could not be found or is inactive.');
    }

    const now = new Date().toISOString();
    const newPasswordHash = hashPassword(params.newPassword);

    // 1. Update password
    db.execute('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
      newPasswordHash,
      now,
      user.id,
    ]);

    // 2. Mark token as used immediately
    db.execute('UPDATE password_resets SET used_at = ? WHERE id = ?', [now, record.id]);

    // 3. Revoke all active sessions for this user so old devices must sign in again
    db.execute('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [
      now,
      user.id,
    ]);

    // 4. Send email confirming password change
    await EmailService.sendPasswordChangedNotification({ recipientEmail: user.email }).catch(() => {});

    return {
      success: true,
      message: 'Your sign-in password has been reset successfully. Please sign in with your new password.',
    };
  }
}
