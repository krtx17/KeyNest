import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/app.ts';
import { resetDatabaseForTesting } from '../src/db/connection.ts';
import { generateTotpCode } from '../src/auth/cryptoUtils.ts';

describe('Phase 2: Authentication, Sessions, Devices & Step-Up Engine', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
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

  it('should register a new user and auto-provision Personal Vault', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'maya@orbitstart.com',
        password: 'SuperSecurePassword123!',
        kdfParams: { salt: 'random_salt', iterations: 100000 },
        keyBundle: 'base64_account_key_bundle==',
        recoveryBundle: 'base64_recovery_bundle==',
      }),
    });

    assert.equal(res.status, 201);
    const data = (await res.json()) as any;
    assert.equal(data.email, 'maya@orbitstart.com');
    assert.ok(data.userId.startsWith('usr_'));
    assert.ok(data.personalWorkspaceId.startsWith('ws_'));
  });

  it('should reject duplicate email registration', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'maya@orbitstart.com',
        password: 'AnotherPassword456!',
      }),
    });

    assert.equal(res.status, 409);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'USER_EXISTS');
  });

  it('should reject login with invalid password', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'maya@orbitstart.com',
        password: 'WrongPassword!',
        deviceName: 'MacBook Pro',
      }),
    });

    assert.equal(res.status, 401);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'INVALID_CREDENTIALS');
  });

  let accessToken: string;
  let refreshToken: string;
  let deviceId: string;

  it('should login with valid password and return tokens and device', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'maya@orbitstart.com',
        password: 'SuperSecurePassword123!',
        deviceName: 'MacBook Pro',
      }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.ok(data.tokens.accessToken);
    assert.ok(data.tokens.refreshToken);
    assert.ok(data.device.id);

    accessToken = data.tokens.accessToken;
    refreshToken = data.tokens.refreshToken;
    deviceId = data.device.id;
  });

  it('should list enrolled devices for authenticated user', async () => {
    const res = await fetch(`${baseUrl}/devices`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.ok(Array.isArray(data.devices));
    assert.ok(data.devices.some((d: any) => d.id === deviceId));
  });

  it('should refresh tokens and rotate refresh token', async () => {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.ok(data.accessToken);
    assert.ok(data.refreshToken);
    assert.notEqual(data.refreshToken, refreshToken);

    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
  });

  it('should reject sensitive action without step-up elevation', async () => {
    // Attempting to revoke device without step-up should return 403 STEP_UP_REQUIRED
    const res = await fetch(`${baseUrl}/devices/${deviceId}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    assert.equal(res.status, 403);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'STEP_UP_REQUIRED');
  });

  it('should perform step-up elevation via Passkey assertion', async () => {
    const res = await fetch(`${baseUrl}/auth/step-up`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ passkeyVerified: true }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.elevated, true);
    assert.ok(data.elevatedUntil);
  });

  it('should allow sensitive action with elevated step-up session', async () => {
    // Now that session is elevated, revoke device should succeed
    const res = await fetch(`${baseUrl}/devices/${deviceId}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.revoked, true);
  });

  it('should reject refresh from a revoked device', async () => {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    assert.equal(res.status, 401);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'DEVICE_REVOKED');
  });

  it('should support TOTP setup and TOTP step-up verification', async () => {
    // Login with a fresh session
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'maya@orbitstart.com',
        password: 'SuperSecurePassword123!',
        deviceName: 'iPhone Client',
      }),
    });
    const loginData = (await loginRes.json()) as any;
    const newAccessToken = loginData.tokens.accessToken;

    // Setup TOTP
    const totpRes = await fetch(`${baseUrl}/auth/setup-totp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newAccessToken}` },
    });
    assert.equal(totpRes.status, 200);
    const { secret } = (await totpRes.json()) as any;
    assert.ok(secret);

    // Generate valid TOTP code
    const validCode = generateTotpCode(secret);

    // Verify step-up with valid code
    const stepUpRes = await fetch(`${baseUrl}/auth/step-up`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${newAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ totpCode: validCode }),
    });
    assert.equal(stepUpRes.status, 200);
    const stepUpData = (await stepUpRes.json()) as any;
    assert.equal(stepUpData.elevated, true);
  });
});
