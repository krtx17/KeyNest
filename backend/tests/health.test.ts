import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/app.ts';
import { resetDatabaseForTesting } from '../src/db/connection.ts';

describe('Health API', () => {
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

  it('GET /api/v1/health should return 200 and healthy status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const data = await res.json() as any;
    assert.equal(data.status, 'healthy');
    assert.equal(data.version, '1.0.0');
    assert.equal(data.services.database, 'connected');
  });
});
