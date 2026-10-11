import crypto from 'node:crypto';
import { getDatabase } from '../db/connection.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type { MemberRole } from '../workspaces/workspaceService.ts';

export interface ItemRecord {
  id: string;
  workspace_id: string;
  collection_id: string | null;
  type: 'login';
  payload_enc: string;
  nonce: string;
  enc_version: number;
  key_version: number;
  revision: number;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ItemKeyRecord {
  id: string;
  item_id: string;
  recipient_user_id: string;
  recipient_device_id: string | null;
  wrapped_key: string;
  permission: 'view_copy' | 'edit';
  key_version: number;
  granted_by: string;
  granted_at: string;
  revoked_at: string | null;
}

export class ItemService {
  /**
   * Helper to resolve user's role in a workspace.
   */
  private static getUserRole(userId: string, workspaceId: string): MemberRole | null {
    const db = getDatabase();
    const mem = db.queryOne<{ role: MemberRole }>(
      `SELECT role FROM memberships WHERE workspace_id = ? AND user_id = ? AND status = 'active'`,
      [workspaceId, userId]
    );
    return mem ? mem.role : null;
  }

  /**
   * Creates a new encrypted item and associated wrapped keys.
   */
  static createItem(params: {
    userId: string;
    workspaceId: string;
    collectionId?: string;
    payloadEnc: string;
    nonce: string;
    encVersion?: number;
    keyVersion?: number;
    wrappedKeys: Array<{
      recipientUserId: string;
      wrappedKey: string;
      permission?: 'view_copy' | 'edit';
    }>;
  }) {
    const db = getDatabase();
    const role = this.getUserRole(params.userId, params.workspaceId);
    if (!role) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to this workspace.');
    }

    const itemId = 'itm_' + crypto.randomUUID();
    const now = new Date().toISOString();
    const encVersion = params.encVersion || 1;
    const keyVersion = params.keyVersion || 1;
    const revision = 1;

    db.execute(
      `INSERT INTO items (id, workspace_id, collection_id, type, payload_enc, nonce, enc_version, key_version, revision, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, 'login', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemId,
        params.workspaceId,
        params.collectionId || null,
        params.payloadEnc,
        params.nonce,
        encVersion,
        keyVersion,
        revision,
        params.userId,
        params.userId,
        now,
        now,
      ]
    );

    // Ensure creator has an item key if not explicitly in wrappedKeys
    const keysToInsert = [...params.wrappedKeys];
    if (!keysToInsert.some((k) => k.recipientUserId === params.userId)) {
      keysToInsert.push({
        recipientUserId: params.userId,
        wrappedKey: params.wrappedKeys[0]?.wrappedKey || 'self_wrapped_key',
        permission: 'edit',
      });
    }

    for (const key of keysToInsert) {
      const keyId = 'key_' + crypto.randomUUID();
      db.execute(
        `INSERT INTO item_keys (id, item_id, recipient_user_id, wrapped_key, permission, key_version, granted_by, granted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          keyId,
          itemId,
          key.recipientUserId,
          key.wrappedKey,
          key.permission || 'edit',
          keyVersion,
          params.userId,
          now,
        ]
      );
    }

    return {
      id: itemId,
      workspaceId: params.workspaceId,
      revision,
      encVersion,
      keyVersion,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Retrieves an encrypted item and caller's wrapped key.
   */
  static getItem(userId: string, itemId: string) {
    const db = getDatabase();
    const item = db.queryOne<ItemRecord>(
      `SELECT * FROM items WHERE id = ? AND deleted_at IS NULL`,
      [itemId]
    );

    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
    }

    const role = this.getUserRole(userId, item.workspace_id);
    if (!role) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this workspace.');
    }

    // Lookup caller's wrapped key
    const itemKey = db.queryOne<ItemKeyRecord>(
      `SELECT * FROM item_keys WHERE item_id = ? AND recipient_user_id = ? AND revoked_at IS NULL`,
      [itemId, userId]
    );

    // If caller is Owner/Admin but has no specific item key, they can view metadata but need wrapped key to decrypt
    return {
      item: {
        id: item.id,
        workspaceId: item.workspace_id,
        collectionId: item.collection_id,
        type: item.type,
        payloadEnc: item.payload_enc,
        nonce: item.nonce,
        encVersion: item.enc_version,
        keyVersion: item.key_version,
        revision: item.revision,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      },
      wrappedKey: itemKey
        ? {
            wrappedKey: itemKey.wrapped_key,
            permission: itemKey.permission,
            keyVersion: itemKey.key_version,
          }
        : null,
      userRole: role,
    };
  }

  /**
   * Updates an encrypted item with optimistic locking (If-Match revision).
   */
  static updateItem(params: {
    userId: string;
    itemId: string;
    expectedRevision?: number;
    payloadEnc: string;
    nonce: string;
    encVersion?: number;
    keyVersion?: number;
  }) {
    const db = getDatabase();
    const item = db.queryOne<ItemRecord>(
      `SELECT * FROM items WHERE id = ? AND deleted_at IS NULL`,
      [params.itemId]
    );

    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
    }

    const role = this.getUserRole(params.userId, item.workspace_id);
    if (!role) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this workspace.');
    }

    // Check caller has edit permission
    if (role !== 'owner' && role !== 'admin') {
      const grant = db.queryOne<ItemKeyRecord>(
        `SELECT permission FROM item_keys WHERE item_id = ? AND recipient_user_id = ? AND revoked_at IS NULL`,
        [params.itemId, params.userId]
      );
      if (!grant || grant.permission !== 'edit') {
        throw new AppError(403, 'PERMISSION_DENIED', 'You do not have edit permission for this item.');
      }
    }

    // Optimistic Concurrency Control
    if (params.expectedRevision !== undefined && params.expectedRevision !== item.revision) {
      throw new AppError(
        412,
        'PRECONDITION_FAILED',
        `Conflict: expected revision ${params.expectedRevision}, but server revision is ${item.revision}.`
      );
    }

    const nextRevision = item.revision + 1;
    const now = new Date().toISOString();

    db.execute(
      `UPDATE items
       SET payload_enc = ?, nonce = ?, enc_version = ?, key_version = ?, revision = ?, updated_by = ?, updated_at = ?
       WHERE id = ?`,
      [
        params.payloadEnc,
        params.nonce,
        params.encVersion || item.enc_version,
        params.keyVersion || item.key_version,
        nextRevision,
        params.userId,
        now,
        params.itemId,
      ]
    );

    return {
      id: params.itemId,
      revision: nextRevision,
      updatedAt: now,
    };
  }

  /**
   * Soft-deletes an item (creates a tombstone for sync).
   */
  static deleteItem(userId: string, itemId: string) {
    const db = getDatabase();
    const item = db.queryOne<ItemRecord>(
      `SELECT * FROM items WHERE id = ? AND deleted_at IS NULL`,
      [itemId]
    );

    if (!item) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
    }

    const role = this.getUserRole(userId, item.workspace_id);
    if (!role) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this workspace.');
    }

    if (role !== 'owner' && role !== 'admin' && item.created_by !== userId) {
      throw new AppError(403, 'PERMISSION_DENIED', 'Only item creator or workspace admins can delete this item.');
    }

    const now = new Date().toISOString();
    const nextRevision = item.revision + 1;

    db.execute(
      `UPDATE items SET deleted_at = ?, revision = ?, updated_at = ? WHERE id = ?`,
      [now, nextRevision, now, itemId]
    );

    return {
      id: itemId,
      deleted: true,
      revision: nextRevision,
    };
  }

  /**
   * Lists encrypted items in a workspace accessible to the caller.
   */
  static listItems(userId: string, workspaceId: string) {
    const db = getDatabase();
    const role = this.getUserRole(userId, workspaceId);
    if (!role) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this workspace.');
    }

    const items = db.query<ItemRecord>(
      `SELECT i.* FROM items i
       WHERE i.workspace_id = ? AND i.deleted_at IS NULL
       ORDER BY i.updated_at DESC`,
      [workspaceId]
    );

    // Fetch caller's wrapped keys for these items
    const keys = db.query<ItemKeyRecord>(
      `SELECT * FROM item_keys WHERE recipient_user_id = ? AND revoked_at IS NULL`,
      [userId]
    );
    const keyMap = new Map(keys.map((k) => [k.item_id, k]));

    return items.map((item) => {
      const userKey = keyMap.get(item.id);
      return {
        id: item.id,
        workspaceId: item.workspace_id,
        collectionId: item.collection_id,
        type: item.type,
        payloadEnc: item.payload_enc,
        nonce: item.nonce,
        encVersion: item.enc_version,
        keyVersion: item.key_version,
        revision: item.revision,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        wrappedKey: userKey?.wrapped_key || null,
        permission: userKey?.permission || (role === 'owner' || role === 'admin' ? 'edit' : 'view_copy'),
      };
    });
  }

  /**
   * Sync API: incremental delta query since given revision.
   */
  static sync(userId: string, workspaceId: string, sinceRevision: number = 0) {
    const db = getDatabase();
    const role = this.getUserRole(userId, workspaceId);
    if (!role) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied to this workspace.');
    }

    const deltas = db.query<ItemRecord>(
      `SELECT * FROM items
       WHERE workspace_id = ? AND revision > ?
       ORDER BY revision ASC`,
      [workspaceId, sinceRevision]
    );

    const latestRevision = db.queryOne<{ max_rev: number | null }>(
      `SELECT MAX(revision) as max_rev FROM items WHERE workspace_id = ?`,
      [workspaceId]
    );

    return {
      workspaceId,
      currentRevision: latestRevision?.max_rev || 0,
      deltas: deltas.map((d) => ({
        id: d.id,
        revision: d.revision,
        isDeleted: d.deleted_at !== null,
        payloadEnc: d.deleted_at ? null : d.payload_enc,
        nonce: d.deleted_at ? null : d.nonce,
        encVersion: d.enc_version,
        keyVersion: d.key_version,
        updatedAt: d.updated_at,
      })),
    };
  }
}
