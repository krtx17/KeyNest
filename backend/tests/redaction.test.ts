import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redactSensitiveData } from '../src/middleware/redactionLogger.ts';

describe('Redaction Engine (Zero Secret Leakage)', () => {
  it('should redact sensitive keys at root level', () => {
    const input = {
      username: 'maya',
      password: 'super_secret_password_123',
      token: 'jwt.token.here',
      payload_enc: 'base64ciphertext==',
      wrapped_key: 'sealed_key_bytes==',
    };

    const output = redactSensitiveData(input) as Record<string, unknown>;

    assert.equal(output.username, 'maya');
    assert.equal(output.password, '[REDACTED]');
    assert.equal(output.token, '[REDACTED]');
    assert.equal(output.payload_enc, '[REDACTED]');
    assert.equal(output.wrapped_key, '[REDACTED]');
  });

  it('should recursively redact nested objects and arrays', () => {
    const input = {
      event: 'user.login',
      user: {
        email: 'maya@example.com',
        auth: {
          password_hash: '$argon2id$...',
          totp_secret: 'JBSWY3DPEHPK3PXP',
        },
      },
      items: [
        { id: '1', secret: 'val1' },
        { id: '2', normal: 'safe' },
      ],
    };

    const output = redactSensitiveData(input) as any;

    assert.equal(output.user.email, 'maya@example.com');
    assert.equal(output.user.auth.password_hash, '[REDACTED]');
    assert.equal(output.user.auth.totp_secret, '[REDACTED]');
    assert.equal(output.items[0].secret, '[REDACTED]');
    assert.equal(output.items[1].normal, 'safe');
  });

  it('should redact Bearer authorization header strings', () => {
    assert.equal(redactSensitiveData('Bearer eyJhbGciOi...'), 'Bearer [REDACTED]');
    assert.equal(redactSensitiveData('bearer my-secret-token'), 'Bearer [REDACTED]');
  });

  it('should preserve non-sensitive values and primitives', () => {
    assert.equal(redactSensitiveData(null), null);
    assert.equal(redactSensitiveData(undefined), undefined);
    assert.equal(redactSensitiveData(42), 42);
    assert.equal(redactSensitiveData('hello world'), 'hello world');
  });
});
