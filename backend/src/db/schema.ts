/**
 * Complete database schema definition matching phase 1/backend-schema.md
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified_at TEXT,
  password_hash TEXT,
  kdf_params TEXT,
  key_bundle TEXT,
  recovery_bundle TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'locked', 'deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('passkey', 'totp')),
  credential_id TEXT,
  public_key TEXT,
  totp_secret_enc TEXT,
  sign_count INTEGER DEFAULT 0,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  identity_public_key TEXT,
  enrolled_by_device_id TEXT,
  revoked_at TEXT,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  refresh_token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  elevated_until TEXT
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('personal', 'team')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  color TEXT DEFAULT '#0D9488',
  description TEXT,
  key_version INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('invited', 'active', 'suspended', 'removed')),
  joined_at TEXT NOT NULL,
  removed_at TEXT,
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invitee_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member')),
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  invited_by TEXT NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name_enc TEXT NOT NULL,
  key_version INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'login' CHECK(type IN ('login')),
  payload_enc TEXT NOT NULL,
  nonce TEXT NOT NULL,
  enc_version INTEGER DEFAULT 1,
  key_version INTEGER DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS workspace_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  wrapped_key TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  granted_by TEXT REFERENCES users(id),
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(workspace_id, recipient_user_id, recipient_device_id, key_version)
);

CREATE TABLE IF NOT EXISTS item_keys (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
  wrapped_key TEXT NOT NULL,
  permission TEXT NOT NULL CHECK(permission IN ('view_copy', 'edit')),
  key_version INTEGER NOT NULL,
  granted_by TEXT REFERENCES users(id),
  granted_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('OK', 'Denied', 'Error')),
  details TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rotation_tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  triggered_by TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK(status IN ('open', 'done', 'dismissed')),
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_cursors (
  device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  last_revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- Core Indices
CREATE INDEX IF NOT EXISTS idx_items_ws_rev ON items(workspace_id, revision);
CREATE INDEX IF NOT EXISTS idx_items_ws_updated ON items(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_memberships_uid_status ON memberships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_workspace_keys_lookup ON workspace_keys(workspace_id, recipient_user_id, key_version);
CREATE INDEX IF NOT EXISTS idx_item_keys_lookup ON item_keys(item_id, recipient_user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_ws_time ON audit_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_dev ON sessions(user_id, device_id);
`;
