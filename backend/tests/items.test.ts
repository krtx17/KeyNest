import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/app.ts';
import { resetDatabaseForTesting, getDatabase } from '../src/db/connection.ts';

describe('Phase 4: Encrypted Vault Items, Key Distribution & Sync Engine', () => {
  let server: Server;
  let baseUrl: string;

  let mayaToken: string;
  let arjunToken: string;
  let workspaceId: string;
  let arjunWsId: string;

  let mayaUserId: string;

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
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maya@orbit.com', password: 'Password123!' }),
    });
    mayaUserId = ((await regRes.json()) as any).userId;

    const mayaLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'maya@orbit.com', password: 'Password123!' }),
    });
    mayaToken = ((await mayaLogin.json()) as any).tokens.accessToken;

    // Create Team Workspace for Maya
    const wsRes = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Orbit Credentials' }),
    });
    workspaceId = ((await wsRes.json()) as any).id;

    // Register Arjun with his own workspace
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

    const arjunWsRes = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${arjunToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Arjun Workspace' }),
    });
    arjunWsId = ((await arjunWsRes.json()) as any).id;
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  let itemId: string;

  it('should create an encrypted vault item with wrapped key envelope', async () => {
    const res = await fetch(`${baseUrl}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        payloadEnc: 'xchacha20poly1305_ciphertext_base64==',
        nonce: '24byte_random_nonce_base64==',
        encVersion: 1,
        keyVersion: 1,
        wrappedKeys: [
          {
            recipientUserId: mayaUserId,
            wrappedKey: 'sealed_dek_for_maya==',
            permission: 'edit',
          },
        ],
      }),
    });

    assert.equal(res.status, 201);
    const data = (await res.json()) as any;
    assert.ok(data.id.startsWith('itm_'));
    assert.equal(data.revision, 1);
    itemId = data.id;
  });

  it('should verify ZERO plaintext passwords exist in the database (Security Audit)', () => {
    const db = getDatabase();
    // Verify item table has no password column
    const columns = db
      .query<{ name: string }>("PRAGMA table_info(items);")
      .map((c) => c.name.toLowerCase());

    assert.ok(!columns.includes('password'), 'Database table must NEVER have a password column');
    assert.ok(columns.includes('payload_enc'), 'Database table must store payload_enc');
    assert.ok(columns.includes('nonce'), 'Database table must store nonce');
  });

  it('should fetch item and caller wrapped key', async () => {
    const res = await fetch(`${baseUrl}/items/${itemId}`, {
      headers: { Authorization: `Bearer ${mayaToken}` },
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.item.id, itemId);
    assert.equal(data.item.payloadEnc, 'xchacha20poly1305_ciphertext_base64==');
    assert.equal(data.item.revision, 1);
    assert.ok(data.wrappedKey);
  });

  it('should update item and increment revision', async () => {
    const res = await fetch(`${baseUrl}/items/${itemId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
        'If-Match': '1',
      },
      body: JSON.stringify({
        payloadEnc: 'updated_ciphertext_base64==',
        nonce: 'updated_nonce_base64==',
      }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.revision, 2);
  });

  it('should reject update with stale revision (Concurrency Conflict 412)', async () => {
    // Current revision is 2. Sending If-Match: 1 should fail.
    const res = await fetch(`${baseUrl}/items/${itemId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${mayaToken}`,
        'Content-Type': 'application/json',
        'If-Match': '1',
      },
      body: JSON.stringify({
        payloadEnc: 'conflicting_ciphertext==',
        nonce: 'conflicting_nonce==',
      }),
    });

    assert.equal(res.status, 412);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'PRECONDITION_FAILED');
  });

  it('should reject Arjun accessing Maya item (Cross-Tenant Isolation)', async () => {
    const res = await fetch(`${baseUrl}/items/${itemId}`, {
      headers: { Authorization: `Bearer ${arjunToken}` },
    });

    assert.equal(res.status, 403);
    const data = (await res.json()) as any;
    assert.equal(data.error.code, 'FORBIDDEN');
  });

  it('should soft-delete item and create tombstone for sync', async () => {
    const res = await fetch(`${baseUrl}/items/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${mayaToken}` },
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as any;
    assert.equal(data.deleted, true);
    assert.equal(data.revision, 3);
  });

  it('should support incremental delta sync', async () => {
    // Sync since revision 0: should include the tombstone
    const resAll = await fetch(`${baseUrl}/sync?workspaceId=${workspaceId}&since=0`, {
      headers: { Authorization: `Bearer ${mayaToken}` },
    });
    assert.equal(resAll.status, 200);
    const dataAll = (await resAll.json()) as any;
    assert.equal(dataAll.currentRevision, 3);
    assert.equal(dataAll.deltas.length, 1);
    assert.equal(dataAll.deltas[0].isDeleted, true);

    // Sync since revision 3: should return zero deltas
    const resUpToDate = await fetch(`${baseUrl}/sync?workspaceId=${workspaceId}&since=3`, {
      headers: { Authorization: `Bearer ${mayaToken}` },
    });
    assert.equal(resUpToDate.status, 200);
    const dataUpToDate = (await resUpToDate.json()) as any;
    assert.equal(dataUpToDate.deltas.length, 0);
  });
});
