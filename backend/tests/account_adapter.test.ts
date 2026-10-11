import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/app.ts';
import { resetDatabaseForTesting } from '../src/db/connection.ts';

describe('Phase 6: Account Lifecycle, Vault Export & Frontend Adapter', () => {
  let server: Server;
  let baseUrl: string;

  let mayaToken: string;
  let mayaUserId: string;
  let arjunToken: string;
  let arjunUserId: string;
  let teamWsId: string;

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

    // Register Maya
    const mayaReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maya@orbit.com', password: 'Password123!' }),
    });
    mayaUserId = ((await mayaReg.json()) as any).userId;

    const mayaLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maya@orbit.com', password: 'Password123!' }),
    });
    mayaToken = ((await mayaLogin.json()) as any).tokens.accessToken;

    // Create Team Workspace
    const wsRes = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Orbit Startup Team' }),
    });
    teamWsId = ((await wsRes.json()) as any).id;

    // Register Arjun & Invite
    const arjunReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'arjun@orbit.com', password: 'Password123!' }),
    });
    arjunUserId = ((await arjunReg.json()) as any).userId;

    const arjunLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'arjun@orbit.com', password: 'Password123!' }),
    });
    arjunToken = ((await arjunLogin.json()) as any).tokens.accessToken;

    const invRes = await fetch(`${baseUrl}/workspaces/${teamWsId}/invites`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'arjun@orbit.com', role: 'member' }),
    });
    const { token } = (await invRes.json()) as any;

    await fetch(`${baseUrl}/invites/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${arjunToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    // Create Encrypted Item
    await fetch(`${baseUrl}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: teamWsId,
        payloadEnc: 'stripe_api_credentials_enc==',
        nonce: 'nonce_123==',
      }),
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should reject vault export without step-up elevation', async () => {
    const res = await fetch(`${baseUrl}/account/export`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mayaToken}` },
    });
    assert.equal(res.status, 403);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'STEP_UP_REQUIRED');
  });

  it('should export vault archive after step-up elevation', async () => {
    // Elevate session
    await fetch(`${baseUrl}/auth/step-up`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ passkeyVerified: true }),
    });

    const res = await fetch(`${baseUrl}/account/export`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mayaToken}` },
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.ok(data.exportedAt);
    assert.ok(data.items.length >= 1);
    assert.ok(data.workspaces.length >= 1);
  });

  it('should reject deleting owner account if workspace has other active members', async () => {
    // Elevate session
    await fetch(`${baseUrl}/auth/step-up`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ passkeyVerified: true }),
    });

    // Attempt to delete Maya while Arjun is active member of Orbit Startup Team
    const res = await fetch(`${baseUrl}/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${mayaToken}` },
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'TRANSFER_OWNERSHIP_FIRST');
  });

  it('should provide full state for AI Studio frontend via FrontendMockAdapter', async () => {
    const res = await fetch(`${baseUrl}/adapter/state`, {
      headers: { Authorization: `Bearer ${mayaToken}` },
    });

    assert.equal(res.status, 200);
    const state = (await res.json()) as any;

    // Verify compliance with phase 2/src/types/vault.ts interfaces
    assert.ok(state.currentUser);
    assert.equal(state.currentUser.email, 'maya@orbit.com');

    assert.ok(Array.isArray(state.workspaces));
    assert.ok(state.workspaces.some((w: any) => w.id === teamWsId));

    assert.ok(Array.isArray(state.members));
    assert.ok(state.members.some((m: any) => m.email === 'arjun@orbit.com'));

    assert.ok(Array.isArray(state.items));
    assert.ok(state.items.length >= 1);
    assert.equal(state.items[0].serviceIcon, 'custom');

    assert.ok(Array.isArray(state.auditEvents));
    assert.ok(state.auditEvents.length >= 1);

    assert.ok(Array.isArray(state.rotationTasks));
  });

  it('should allow account deletion after transferring ownership', async () => {
    // Transfer ownership of Orbit Startup Team to Arjun
    const transferRes = await fetch(`${baseUrl}/workspaces/${teamWsId}/transfer-owner`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newOwnerId: arjunUserId }),
    });
    assert.equal(transferRes.status, 200);

    // Delete Maya account (now succeeds)
    const deleteRes = await fetch(`${baseUrl}/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${mayaToken}` },
    });
    assert.equal(deleteRes.status, 200);
    const deleteData = (await deleteRes.json()) as any;
    assert.equal(deleteData.deleted, true);

    // Verify Maya's tokens are now revoked
    const revokedRes = await fetch(`${baseUrl}/workspaces`, {
      headers: { Authorization: `Bearer ${mayaToken}` },
    });
    assert.equal(revokedRes.status, 401);
  });
});
