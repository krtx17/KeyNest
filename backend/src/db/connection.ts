import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema.ts';
import { config } from '../config/index.ts';
import { logger } from '../middleware/redactionLogger.ts';

export interface DatabaseConnection {
  query<T = unknown>(sql: string, params?: unknown[]): T[];
  queryOne<T = unknown>(sql: string, params?: unknown[]): T | null;
  execute(sql: string, params?: unknown[]): { changes: number };
  exec(sql: string): void;
  migrate(): void;
  close(): void;
}

class SqliteDatabase implements DatabaseConnection {
  private db: DatabaseSync;

  constructor(location: string = ':memory:') {
    this.db = new DatabaseSync(location);
    this.exec('PRAGMA foreign_keys = ON;');
  }

  query<T = unknown>(sql: string, params: unknown[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...(params as any[])) as T[];
  }

  queryOne<T = unknown>(sql: string, params: unknown[] = []): T | null {
    const rows = this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  execute(sql: string, params: unknown[] = []): { changes: number } {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...(params as any[]));
    return { changes: Number(result.changes) };
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  migrate(): void {
    logger.info('Running database migrations...');
    this.exec(SCHEMA_SQL);
    try {
      this.exec('ALTER TABLE item_invitations ADD COLUMN service_name TEXT DEFAULT ""');
    } catch {}
    try {
      this.exec('ALTER TABLE item_invitations ADD COLUMN wrapped_key TEXT DEFAULT ""');
    } catch {}
    logger.info('Database migrations applied successfully.');
  }

  private isOpen = true;

  close(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.db.close();
    }
  }
}

let dbInstance: DatabaseConnection | null = null;

export function getDatabase(customPath?: string): DatabaseConnection {
  if (!dbInstance) {
    const dbPath = customPath || (config.USE_IN_MEMORY_DB ? ':memory:' : 'vaultshare.sqlite');
    dbInstance = new SqliteDatabase(dbPath);
    dbInstance.migrate();
  }
  return dbInstance;
}

export function resetDatabaseForTesting(): DatabaseConnection {
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = new SqliteDatabase(':memory:');
  dbInstance.migrate();
  return dbInstance;
}
