import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/app.ts';
import { resetDatabaseForTesting, getDatabase } from '../src/db/connection.ts';
import { EmailService } from '../src/email/emailService.ts';
import { config } from '../src/config/index.ts';

describe('Password Sharing via Email Invitations and Acceptance', () => {
  let server: Server;
  let baseUrl: string;

  let senderToken: string;
  let senderUserId: string;
  let recipientToken: string;
  let recipientUserId: string;
  let intruderToken: string;
  let workspaceId: string;
  let itemId: string;

  before(async () => {
    (config as any).NODE_ENV = 'test';
    (config as any).EMAIL_PROVIDER = 'test';
    resetDatabaseForTesting();
    EmailService.clearSentEmails();

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

    // 1. Register Sender (Alice)
    const senderReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@company.com', password: 'Password123!' }),
    });
    senderUserId = ((await senderReg.json()) as any).userId;

    const senderLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@company.com', password: 'Password123!' }),
    });
    senderToken = ((await senderLogin.json()) as any).tokens.accessToken;

    // 2. Register Recipient (Bob)
    const recReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@company.com', password: 'Password123!' }),
    });
    recipientUserId = ((await recReg.json()) as any).userId;

    const recLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bob@company.com', password: 'Password123!' }),
    });
    recipientToken = ((await recLogin.json()) as any).tokens.accessToken;

    // 3. Register Intruder (Eve)
    const eveReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'eve@company.com', password: 'Password123!' }),
    });
    const eveLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'eve@company.com', password: 'Password123!' }),
    });
    intruderToken = ((await eveLogin.json()) as any).tokens.accessToken;

    // 4. Create Workspace for Alice
    const wsRes = await fetch(`${baseUrl}/workspaces`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${senderToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Alice Personal Workspace' }),
    });
    workspaceId = ((await wsRes.json()) as any).id;

    // 5. Create Item in Workspace
    const itemRes = await fetch(`${baseUrl}/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${senderToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        payloadEnc: 'super_secret_github_password_enc',
        nonce: 'nonce123',
        wrappedKeys: [
          {
            recipientUserId: senderUserId,
            wrappedKey: 'key_alice',
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

  it('should send an email invitation without passwords or secrets in the email', async () => {
    EmailService.clearSentEmails();

    const res = await fetch(`${baseUrl}/items/${itemId}/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${senderToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientName: 'Bob Teammate',
        recipientEmail: 'bob@company.com',
        serviceName: 'GitHub Enterprise',
        permission: 'view_copy',
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as any;
    assert.equal(body.recipientEmail, 'bob@company.com');
    assert.equal(body.serviceName, 'GitHub Enterprise');
    assert.equal(body.permission, 'view_copy');
    assert.equal(body.status, 'pending');

    // Verify dispatched email in test sink
    const sent = EmailService.getSentEmails();
    assert.equal(sent.length, 1);
    const email = sent[0];
    assert.equal(email.to, 'bob@company.com');
    assert.ok(email.subject.includes('shared a password with you'));
    assert.ok(email.text.includes('GitHub Enterprise'));
    // Zero-secrets assertion: NEVER contain password or ciphertext
    assert.ok(!email.text.includes('super_secret_github_password_enc'));
    assert.ok(!email.html.includes('super_secret_github_password_enc'));
    assert.ok(!email.text.includes('key_alice'));

    // Check token link in email
    assert.ok(email.text.includes('?invite='));
    assert.ok(email.html.includes('?invite='));
  });

  it('should hash token in database and never store raw invitation token', async () => {
    const sent = EmailService.getSentEmails();
    const rawToken = sent[0].inviteToken;
    assert.ok(rawToken);

    const db = getDatabase();
    const rawMatch = db.queryOne<{ id: string }>(
      `SELECT id FROM item_invitations WHERE token_hash = ?`,
      [rawToken]
    );
    assert.equal(rawMatch, null, 'Raw token should NEVER match token_hash column');

    // Verify token_hash is stored as 64-char sha256 hex
    const hashMatch = db.queryOne<{ token_hash: string }>(
      `SELECT token_hash FROM item_invitations WHERE recipient_email = 'bob@company.com'`
    );
    assert.ok(hashMatch);
    assert.equal(hashMatch.token_hash.length, 64);
  });

  it('should verify invitation details publicly without returning passwords or keys', async () => {
    const sent = EmailService.getSentEmails();
    const rawToken = sent[0].inviteToken;

    const res = await fetch(`${baseUrl}/invitations/verify?token=${rawToken}`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;

    assert.equal(body.isValid, true);
    assert.equal(body.status, 'pending');
    assert.equal(body.serviceName, 'GitHub Enterprise');
    assert.equal(body.recipientEmail, 'bob@company.com');
    assert.equal(body.recipientName, 'Bob Teammate');
    assert.equal(body.permission, 'view_copy');
    // Ensure no secrets leaked
    assert.equal(body.password, undefined);
    assert.equal(body.payloadEnc, undefined);
    assert.equal(body.wrappedKey, undefined);
  });

  it('should reject acceptance if signed in as a different user (Email Mismatch Protection)', async () => {
    const sent = EmailService.getSentEmails();
    const rawToken = sent[0].inviteToken;

    // Eve (intruder) tries to accept Bob's invitation
    const res = await fetch(`${baseUrl}/invitations/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${intruderToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: rawToken }),
    });

    assert.equal(res.status, 403);
    const body = (await res.json()) as any;
    assert.equal(body.error.code, 'EMAIL_MISMATCH');
    assert.ok(body.error.message.includes('bob@company.com'));
  });

  it('should grant access when accepted by the correct recipient', async () => {
    const sent = EmailService.getSentEmails();
    const rawToken = sent[0].inviteToken;

    // Bob accepts his invitation
    const res = await fetch(`${baseUrl}/invitations/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${recipientToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: rawToken }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.accepted, true);
    assert.equal(body.itemId, itemId);
    assert.equal(body.permission, 'view_copy');

    // Verify recipient now has an active item key in database
    const db = getDatabase();
    const key = db.queryOne<{ id: string; permission: string }>(
      `SELECT id, permission FROM item_keys WHERE item_id = ? AND recipient_user_id = ? AND revoked_at IS NULL`,
      [itemId, recipientUserId]
    );
    assert.ok(key, 'Item key must exist for recipient after acceptance');
    assert.equal(key.permission, 'view_copy');

    // Verify invitation is marked accepted
    const inv = db.queryOne<{ accepted_at: string; accepted_by: string }>(
      `SELECT accepted_at, accepted_by FROM item_invitations WHERE recipient_email = 'bob@company.com'`
    );
    assert.ok(inv?.accepted_at);
    assert.equal(inv?.accepted_by, recipientUserId);
  });

  it('should reject re-using an already accepted invitation token (single-use)', async () => {
    const sent = EmailService.getSentEmails();
    const rawToken = sent[0].inviteToken;

    const res = await fetch(`${baseUrl}/invitations/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${recipientToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: rawToken }),
    });

    assert.equal(res.status, 409);
    const body = (await res.json()) as any;
    assert.equal(body.error.code, 'INVITATION_ALREADY_ACCEPTED');
  });

  it('should show updated statuses when sender lists invitations', async () => {
    const res = await fetch(`${baseUrl}/items/${itemId}/invitations`, {
      headers: {
        Authorization: `Bearer ${senderToken}`,
      },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.ok(Array.isArray(body.invitations));
    const bobInv = body.invitations.find((i: any) => i.recipientEmail === 'bob@company.com');
    assert.ok(bobInv);
    assert.equal(bobInv.status, 'accepted');
  });

  it('should allow sender to revoke a pending invitation', async () => {
    // 1. Create invitation for another user
    const res = await fetch(`${baseUrl}/items/${itemId}/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${senderToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientName: 'David Developer',
        recipientEmail: 'david@company.com',
        serviceName: 'GitHub Enterprise',
        permission: 'edit',
      }),
    });

    assert.equal(res.status, 201);
    const created = (await res.json()) as any;
    assert.equal(created.status, 'pending');

    const sent = EmailService.getSentEmails();
    const davidToken = sent[sent.length - 1].inviteToken;

    // 2. Sender cancels / revokes the invitation
    const delRes = await fetch(`${baseUrl}/items/${itemId}/invitations/${created.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${senderToken}`,
      },
    });
    assert.equal(delRes.status, 200);

    // 3. Verifying the token now shows status 'revoked'
    const verifyRes = await fetch(`${baseUrl}/invitations/verify?token=${davidToken}`);
    const verifyBody = (await verifyRes.json()) as any;
    assert.equal(verifyBody.isValid, false);
    assert.equal(verifyBody.status, 'revoked');

    // 4. Attempting to accept fails with 410 INVITATION_REVOKED
    // Register David
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'david@company.com', password: 'Password123!' }),
    });
    const davidLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'david@company.com', password: 'Password123!' }),
    });
    const davidAuthToken = ((await davidLogin.json()) as any).tokens.accessToken;

    const acceptRes = await fetch(`${baseUrl}/invitations/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${davidAuthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: davidToken }),
    });
    assert.equal(acceptRes.status, 410);
    const acceptBody = (await acceptRes.json()) as any;
    assert.equal(acceptBody.error.code, 'INVITATION_REVOKED');
  });

  it('should return 503 EMAIL_DELIVERY_NOT_CONFIGURED and fail safely if email provider is unconfigured', async () => {
    // Temporarily switch environment to simulate unconfigured email
    const originalEnv = config.NODE_ENV;
    const originalProvider = config.EMAIL_PROVIDER;
    const originalResendKey = config.RESEND_API_KEY;

    try {
      (config as any).NODE_ENV = 'production';
      (config as any).EMAIL_PROVIDER = '';
      (config as any).RESEND_API_KEY = '';

      const res = await fetch(`${baseUrl}/items/${itemId}/invitations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${senderToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientName: 'Frank',
          recipientEmail: 'frank@company.com',
          permission: 'view_copy',
        }),
      });

      assert.equal(res.status, 503);
      const body = (await res.json()) as any;
      assert.equal(body.error.code, 'EMAIL_DELIVERY_NOT_CONFIGURED');
      assert.ok(body.error.message.includes('Email delivery is not configured'));

      // Ensure no dangling invitation was created in the database
      const db = getDatabase();
      const frankInv = db.queryOne(
        `SELECT id FROM item_invitations WHERE recipient_email = 'frank@company.com'`
      );
      assert.equal(frankInv, null, 'No invitation record should exist if email fails');
    } finally {
      (config as any).NODE_ENV = originalEnv;
      (config as any).EMAIL_PROVIDER = originalProvider;
      (config as any).RESEND_API_KEY = originalResendKey;
    }
  });
});
