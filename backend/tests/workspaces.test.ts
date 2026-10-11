import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/app.ts';
import { resetDatabaseForTesting } from '../src/db/connection.ts';

describe('Phase 3: Workspaces, Memberships & Granular RBAC', () => {
  let server: Server;
  let baseUrl: string;

  let mayaToken: string;
  let arjunToken: string;
  let mayaWsId: string;
  let arjunWsId: string;

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
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maya@orbit.com', password: 'Password123!' }),
    });
    const mayaLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maya@orbit.com', password: 'Password123!' }),
    });
    mayaToken = ((await mayaLogin.json()) as any).tokens.accessToken;

    // Register Arjun
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'arjun@other.com', password: 'Password123!' }),
    });
    const arjunLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'arjun@other.com', password: 'Password123!' }),
    });
    arjunToken = ((await arjunLogin.json()) as any).tokens.accessToken;
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("should list user's default Personal Vault", async () => {
    const res = await fetch(`${baseUrl}/workspaces`, {
      headers: { Authorization: `Bearer ${mayaToken}` },
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.workspaces.length, 1);
    assert.equal(data.workspaces[0].kind, 'personal');
    assert.equal(data.workspaces[0].role, 'owner');
  });

  it('should create a team workspace for Maya', async () => {
    const res = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Orbit Startup',
        description: 'Core team credentials',
        color: '#0D9488',
      }),
    });
    assert.equal(res.status, 201);
    const data = (await res.json()) as any;
    assert.equal(data.name, 'Orbit Startup');
    assert.equal(data.kind, 'team');
    mayaWsId = data.id;
  });

  it('should create a team workspace for Arjun', async () => {
    const res = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${arjunToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Arjun Independent Vault',
      }),
    });
    assert.equal(res.status, 201);
    const data = (await res.json()) as any;
    arjunWsId = data.id;
  });

  // Cross-tenant Isolation Tests
  it('should reject Arjun accessing Maya workspace (Cross-Tenant BOLA / IDOR)', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${mayaWsId}`, {
      headers: { Authorization: `Bearer ${arjunToken}` },
    });
    assert.equal(res.status, 403);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'FORBIDDEN');
  });

  it('should reject Arjun creating an invitation in Maya workspace', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${mayaWsId}/invites`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${arjunToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'intruder@test.com', role: 'admin' }),
    });
    assert.equal(res.status, 403);
  });

  let inviteToken: string;

  it('should allow Maya (Owner) to create invitation for Arjun', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${mayaWsId}/invites`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'arjun@other.com', role: 'member' }),
    });
    assert.equal(res.status, 201);
    const data = (await res.json()) as any;
    assert.ok(data.token);
    assert.equal(data.role, 'member');
    inviteToken = data.token;
  });

  it('should allow Arjun to accept invitation and join workspace', async () => {
    const res = await fetch(`${baseUrl}/invites/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${arjunToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: inviteToken }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.accepted, true);
    assert.equal(data.workspaceId, mayaWsId);

    // Verify Arjun can now access Maya workspace
    const wsRes = await fetch(`${baseUrl}/workspaces/${mayaWsId}`, {
      headers: { Authorization: `Bearer ${arjunToken}` },
    });
    assert.equal(wsRes.status, 200);
  });

  it('should reject re-using an already accepted invitation token', async () => {
    const res = await fetch(`${baseUrl}/invites/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${arjunToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: inviteToken }),
    });
    assert.equal(res.status, 404);
  });

  it('should reject Arjun (Member) attempting to invite someone (RBAC matrix)', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${mayaWsId}/invites`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${arjunToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'nina@orbit.com', role: 'member' }),
    });
    assert.equal(res.status, 403);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'INSUFFICIENT_PERMISSIONS');
  });

  let arjunUserId: string;

  it('should allow Maya to promote Arjun to Admin with step-up elevation', async () => {
    // Elevate Maya's session first
    await fetch(`${baseUrl}/auth/step-up`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ passkeyVerified: true }),
    });

    // Find Arjun's user ID from workspace members
    const wsRes = await fetch(`${baseUrl}/workspaces/${mayaWsId}`, {
      headers: { Authorization: `Bearer ${mayaToken}` },
    });
    const wsData = (await wsRes.json()) as any;
    const arjunMember = wsData.members.find((m: any) => m.email === 'arjun@other.com');
    assert.ok(arjunMember);
    arjunUserId = arjunMember.id;

    // Promote Arjun to admin
    const promoteRes = await fetch(`${baseUrl}/workspaces/${mayaWsId}/members/${arjunUserId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'admin' }),
    });
    assert.equal(promoteRes.status, 200);

    // Verify Arjun is now admin
    const verifyRes = await fetch(`${baseUrl}/workspaces/${mayaWsId}`, {
      headers: { Authorization: `Bearer ${arjunToken}` },
    });
    const verifyData = (await verifyRes.json()) as any;
    assert.equal(verifyData.workspace.role, 'admin');
  });

  it('should allow Arjun (now Admin) to create invitations', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${mayaWsId}/invites`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${arjunToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'nina@orbit.com', role: 'member' }),
    });
    assert.equal(res.status, 201);
  });
});
