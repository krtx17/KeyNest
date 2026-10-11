import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/app.ts';
import { resetDatabaseForTesting, getDatabase } from '../src/db/connection.ts';

describe('Phase 5: Sharing, Offboarding, Key Rotation & Audit Trails', () => {
  let server: Server;
  let baseUrl: string;

  let mayaToken: string;
  let mayaUserId: string;
  let arjunToken: string;
  let arjunUserId: string;
  let workspaceId: string;
  let itemId: string;

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

    // 1. Register Maya
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

    // 2. Create Workspace
    const wsRes = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Orbit Team Vault' }),
    });
    workspaceId = ((await wsRes.json()) as any).id;

    // 3. Register Arjun
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

    // 4. Invite Arjun to Workspace & Accept
    const inviteRes = await fetch(`${baseUrl}/workspaces/${workspaceId}/invites`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'arjun@orbit.com', role: 'member' }),
    });
    const { token } = (await inviteRes.json()) as any;

    await fetch(`${baseUrl}/invites/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${arjunToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    // 5. Create Vault Item
    const itemRes = await fetch(`${baseUrl}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        payloadEnc: 'instagram_credentials_ciphertext==',
        nonce: 'nonce_bytes==',
        wrappedKeys: [
          {
            recipientUserId: mayaUserId,
            wrappedKey: 'sealed_key_for_maya==',
            permission: 'edit',
          },
        ],
      }),
    });
    itemId = ((await itemRes.json()) as any).id;
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should reject sharing item without step-up re-authentication', async () => {
    const res = await fetch(`${baseUrl}/items/${itemId}/shares`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientUserId: arjunUserId,
        wrappedKey: 'sealed_key_for_arjun==',
        permission: 'view_copy',
      }),
    });

    assert.equal(res.status, 403);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'STEP_UP_REQUIRED');
  });

  it('should share item with Arjun after step-up elevation', async () => {
    // Elevate Maya session
    await fetch(`${baseUrl}/auth/step-up`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ passkeyVerified: true }),
    });

    // Share item
    const res = await fetch(`${baseUrl}/items/${itemId}/shares`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientUserId: arjunUserId,
        wrappedKey: 'sealed_key_for_arjun==',
        permission: 'view_copy',
      }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.shared, true);
    assert.equal(data.permission, 'view_copy');

    // Verify Arjun can now fetch the item and his wrapped key
    const arjunItemRes = await fetch(`${baseUrl}/items/${itemId}`, {
      headers: { Authorization: `Bearer ${arjunToken}` },
    });
    assert.equal(arjunItemRes.status, 200);
    const arjunItemData = (await arjunItemRes.json()) as any;
    assert.equal(arjunItemData.wrappedKey.wrappedKey, 'sealed_key_for_arjun==');
  });

  it('should verify audit events were recorded without secret values', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${workspaceId}/audit`, {
      headers: { Authorization: `Bearer ${mayaToken}` },
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.ok(data.events.length > 0);

    const shareEvent = data.events.find((e: any) => e.action === 'item.share');
    assert.ok(shareEvent);
    assert.equal(shareEvent.outcome, 'OK');

    // Verify no secret or password exists in audit details
    for (const event of data.events) {
      if (event.details) {
        assert.ok(!event.details.includes('password'));
        assert.ok(!event.details.includes('sealed_key'));
      }
    }
  });

  it('should offboard Arjun, increment workspace key_version, and generate rotation task', async () => {
    // Elevate Maya session
    await fetch(`${baseUrl}/auth/step-up`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ passkeyVerified: true }),
    });

    // Offboard Arjun
    const res = await fetch(`${baseUrl}/workspaces/${workspaceId}/members/${arjunUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${mayaToken}` },
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.offboarded, true);
    assert.equal(data.rotationTasksGenerated, 1);

    // Verify workspace key_version incremented from 1 to 2
    const wsRes = await fetch(`${baseUrl}/workspaces/${workspaceId}`, {
      headers: { Authorization: `Bearer ${mayaToken}` },
    });
    const wsData = (await wsRes.json()) as any;
    assert.equal(wsData.workspace.keyVersion, 2);

    // Verify Arjun is now immediately denied access
    const arjunDeniedRes = await fetch(`${baseUrl}/workspaces/${workspaceId}`, {
      headers: { Authorization: `Bearer ${arjunToken}` },
    });
    assert.equal(arjunDeniedRes.status, 403);
  });

  it('should list rotation tasks and toggle completion status', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${workspaceId}/rotation-tasks`, {
      headers: { Authorization: `Bearer ${mayaToken}` },
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.tasks.length, 1);
    const task = data.tasks[0];
    assert.equal(task.isDone, false);

    // Toggle task to done
    const toggleRes = await fetch(`${baseUrl}/rotation-tasks/${task.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isDone: true }),
    });

    assert.equal(toggleRes.status, 200);
    const toggleData = (await toggleRes.json()) as any;
    assert.equal(toggleData.isDone, true);
    assert.equal(toggleData.status, 'done');
  });

  it('should reject offboarding workspace owner', async () => {
    // Elevate Maya session
    await fetch(`${baseUrl}/auth/step-up`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ passkeyVerified: true }),
    });

    // Attempt to remove Maya (Owner)
    const res = await fetch(`${baseUrl}/workspaces/${workspaceId}/members/${mayaUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${mayaToken}` },
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'CANNOT_OFFBOARD_OWNER');
  });
});
