import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/app.ts';
import { resetDatabaseForTesting, getDatabase } from '../src/db/connection.ts';
import { EmailService } from '../src/email/emailService.ts';
import { config } from '../src/config/index.ts';

describe('Phase 4: Forgot Sign-in Password & Secure Reset Flow', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    (config as any).NODE_ENV = 'test';
    (config as any).EMAIL_PROVIDER = 'test';
    resetDatabaseForTesting();
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://localhost:${addr.port}/api/v1`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    EmailService.clearSentEmails();
  });

  const testUser = {
    email: 'reset_user@example.com',
    password: 'InitialPassword123!',
  };

  it('should set up a registered user with active session', async () => {
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    assert.equal(regRes.status, 201);
    const regData = (await regRes.json()) as any;
    assert.ok(regData.tokens.accessToken);
    assert.ok(regData.tokens.refreshToken);
  });

  it('should report setup needed (503) if email delivery is not configured', async () => {
    const originalProvider = config.EMAIL_PROVIDER;
    const originalKey = config.RESEND_API_KEY;
    const originalEnv = config.NODE_ENV;
    (config as any).NODE_ENV = 'production';
    (config as any).EMAIL_PROVIDER = 'none';
    (config as any).RESEND_API_KEY = undefined;

    try {
      const res = await fetch(`${baseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testUser.email }),
      });

      assert.equal(res.status, 503);
      const data = (await res.json()) as any;
      assert.equal(data.error.code, 'EMAIL_DELIVERY_NOT_CONFIGURED');
      assert.ok(data.error.message.includes('RESEND_API_KEY'));
    } finally {
      (config as any).NODE_ENV = originalEnv;
      (config as any).EMAIL_PROVIDER = originalProvider;
      (config as any).RESEND_API_KEY = originalKey;
    }
  });

  it('should return simple confirmation and send reset email without leaking user existence', async () => {
    // 1. Registered user
    const res = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.success, true);
    assert.equal(data.message, 'If an account exists for this email address, a password reset link has been sent.');

    const sentEmails = EmailService.getSentEmails();
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, testUser.email);
    assert.equal(sentEmails[0].type, 'password_reset');
    assert.ok(sentEmails[0].resetToken);
    // Ensure the email NEVER contains the user's password
    assert.ok(!sentEmails[0].text.includes(testUser.password));
    assert.ok(!sentEmails[0].html.includes(testUser.password));

    // 2. Non-existent user gets identical response, but no email dispatched
    EmailService.clearSentEmails();
    const unknownRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent_account@example.com' }),
    });

    assert.equal(unknownRes.status, 200);
    const unknownData = (await unknownRes.json()) as any;
    assert.equal(unknownData.success, true);
    assert.equal(unknownData.message, 'If an account exists for this email address, a password reset link has been sent.');
    assert.equal(EmailService.getSentEmails().length, 0);
  });

  it('should enforce rate limiting on excessive reset requests (429)', async () => {
    const rateLimitEmail = 'ratelimit@example.com';
    // Register rateLimitEmail first
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: rateLimitEmail, password: 'StrongPassword123!' }),
    });

    // Request 1
    const r1 = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: rateLimitEmail }),
    });
    assert.equal(r1.status, 200);

    // Request 2
    const r2 = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: rateLimitEmail }),
    });
    assert.equal(r2.status, 200);

    // Request 3
    const r3 = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: rateLimitEmail }),
    });
    assert.equal(r3.status, 200);

    // Request 4 -> should trigger 429
    const r4 = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: rateLimitEmail }),
    });
    assert.equal(r4.status, 429);
    const d4 = (await r4.json()) as any;
    assert.equal(d4.error.code, 'RATE_LIMIT_EXCEEDED');
  });

  it('should verify valid reset token and reject invalid/expired token', async () => {
    EmailService.clearSentEmails();
    await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email }),
    });

    const sentEmails = EmailService.getSentEmails();
    const validToken = sentEmails[0].resetToken!;

    // 1. Invalid token
    const invalidRes = await fetch(`${baseUrl}/auth/password-reset/verify?token=fake_random_token_123`);
    assert.equal(invalidRes.status, 400);

    // 2. Valid token
    const validRes = await fetch(`${baseUrl}/auth/password-reset/verify?token=${validToken}`);
    assert.equal(validRes.status, 200);
    const validData = (await validRes.json()) as any;
    assert.equal(validData.valid, true);
    assert.equal(validData.email, testUser.email);
  });

  it('should reset password, revoke existing sessions, prevent token reuse, and send security notification', async () => {
    // Login to establish an active session before reset
    const loginBeforeRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });
    assert.equal(loginBeforeRes.status, 200);
    const oldLoginData = (await loginBeforeRes.json()) as any;
    const oldAccessToken = oldLoginData.tokens.accessToken;

    // Verify old access token works
    const devResBefore = await fetch(`${baseUrl}/devices`, {
      headers: { Authorization: `Bearer ${oldAccessToken}` },
    });
    assert.equal(devResBefore.status, 200);

    // Request reset
    EmailService.clearSentEmails();
    await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email }),
    });

    const sentEmails = EmailService.getSentEmails();
    const resetToken = sentEmails[0].resetToken!;

    // Complete password reset
    const newPassword = 'BrandNewSuperPassword999!';
    const resetRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        newPassword,
      }),
    });

    assert.equal(resetRes.status, 200);
    const resetData = (await resetRes.json()) as any;
    assert.equal(resetData.success, true);

    // 1. Single-use: Attempting to reuse the token must be rejected
    const reuseRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        newPassword: 'AnotherPassword000!',
      }),
    });
    assert.equal(reuseRes.status, 400);

    // 2. Old sessions revoked: Old access token must now fail
    const devResAfter = await fetch(`${baseUrl}/devices`, {
      headers: { Authorization: `Bearer ${oldAccessToken}` },
    });
    assert.equal(devResAfter.status, 401);

    // 3. Old password fails
    const oldLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });
    assert.equal(oldLoginRes.status, 401);

    // 4. New password succeeds
    const newLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: newPassword }),
    });
    assert.equal(newLoginRes.status, 200);
    const newLoginData = (await newLoginRes.json()) as any;
    assert.ok(newLoginData.tokens.accessToken);

    // 5. Password changed notification email was dispatched
    const emailsAfterReset = EmailService.getSentEmails();
    const changedNotification = emailsAfterReset.find((e) => e.type === 'password_changed');
    assert.ok(changedNotification);
    assert.equal(changedNotification.to, testUser.email);
  });
});
