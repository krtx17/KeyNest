import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetDatabaseForTesting } from '../src/db/connection.ts';
import type { DatabaseConnection } from '../src/db/connection.ts';

describe('Database Schema & Migrations', () => {
  let db: DatabaseConnection;

  beforeEach(() => {
    db = resetDatabaseForTesting();
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required tables', () => {
    const tables = db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    ).map((r) => r.name);

    const requiredTables = [
      'users',
      'auth_credentials',
      'devices',
      'sessions',
      'workspaces',
      'memberships',
      'invitations',
      'collections',
      'items',
      'workspace_keys',
      'item_keys',
      'audit_events',
      'rotation_tasks',
      'sync_cursors',
    ];

    for (const table of requiredTables) {
      assert.ok(tables.includes(table), `Table ${table} should exist in database schema`);
    }
  });

  it('should enforce foreign key integrity', () => {
    // Inserting a device with non-existent user should fail
    assert.throws(() => {
      db.execute(
        "INSERT INTO devices (id, user_id, name, last_seen_at) VALUES ('d1', 'nonexistent_user', 'MacBook', '2026-10-11T00:00:00Z');"
      );
    });
  });

  it('should enforce unique membership per user and workspace', () => {
    const now = new Date().toISOString();
    db.execute(
      "INSERT INTO users (id, email, created_at, updated_at) VALUES ('u1', 'user@example.com', ?, ?);",
      [now, now]
    );
    db.execute(
      "INSERT INTO workspaces (id, name, kind, owner_id, created_at) VALUES ('w1', 'Orbit', 'team', 'u1', ?);",
      [now]
    );
    db.execute(
      "INSERT INTO memberships (id, workspace_id, user_id, role, status, joined_at) VALUES ('m1', 'w1', 'u1', 'owner', 'active', ?);",
      [now]
    );

    // Second membership for same user in same workspace should violate unique constraint
    assert.throws(() => {
      db.execute(
        "INSERT INTO memberships (id, workspace_id, user_id, role, status, joined_at) VALUES ('m2', 'w1', 'u1', 'member', 'active', ?);",
        [now]
      );
    });
  });
});
