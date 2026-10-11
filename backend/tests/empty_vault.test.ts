import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.ts';
import { resetDatabaseForTesting } from '../src/db/connection.ts';

describe('Release Readiness: Clean Sign-Up, Empty Vault & User Isolation', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    resetDatabaseForTesting();
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}/api/v1`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  let userAToken: string;
  let userAWorkspaceId: string;
  let userBToken: string;
  let userBWorkspaceId: string;

  it('should register a new account starting with an empty vault', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@keynest.test',
        password: 'AliceMasterPassword#2026',
      }),
    });

    assert.equal(res.status, 201);
    const data = (await res.json()) as any;
    assert.ok(data.userId);
    assert.equal(data.email, 'alice@keynest.test');
    assert.ok(data.personalWorkspaceId);
    userAWorkspaceId = data.personalWorkspaceId;
  });

  it('should sign in with newly registered credentials', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@keynest.test',
        password: 'AliceMasterPassword#2026',
        deviceName: 'Alice Chrome Laptop',
      }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.ok(data.tokens.accessToken);
    userAToken = data.tokens.accessToken;
  });

  it('should confirm new account has 0 items initially (empty vault)', async () => {
    const res = await fetch(`${baseUrl}/items?workspaceId=${userAWorkspaceId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.items.length, 0, 'New user must start with zero credentials');
  });

  it('should register a second user Bob with zero credentials', async () => {
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob@keynest.test',
        password: 'BobMasterPassword#2026',
      }),
    });
    assert.equal(regRes.status, 201);
    const regData = (await regRes.json()) as any;
    userBWorkspaceId = regData.personalWorkspaceId;

    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bob@keynest.test',
        password: 'BobMasterPassword#2026',
        deviceName: 'Bob Phone',
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = (await loginRes.json()) as any;
    userBToken = loginData.tokens.accessToken;
  });

  it('should allow Alice to add her first password to her empty vault', async () => {
    const res = await fetch(`${baseUrl}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAToken}`,
      },
      body: JSON.stringify({
        workspaceId: userAWorkspaceId,
        payloadEnc: 'YWxpY2VfZW5jcnlwdGVkX2FhZHNfcGF5bG9hZA==', // base64 ciphertext
        nonce: 'bm9uY2VfMTJfYnl0ZXM=',
        encVersion: 1,
        keyVersion: 1,
      }),
    });

    assert.equal(res.status, 201);
    const data = (await res.json()) as any;
    assert.ok(data.id);
  });

  it('should enforce tenant isolation: Bob cannot access Alice items', async () => {
    const res = await fetch(`${baseUrl}/items?workspaceId=${userAWorkspaceId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });

    assert.equal(res.status, 403, 'Cross-user workspace access must be forbidden');
  });

  it('should reject login with wrong password with everyday error message', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@keynest.test',
        password: 'WrongPassword123!',
        deviceName: 'Attacker Machine',
      }),
    });

    assert.equal(res.status, 401);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'INVALID_CREDENTIALS');
  });
});
