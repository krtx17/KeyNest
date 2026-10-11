# Walkthrough — Shared Credential Vault Backend & Architecture

> **Document Status:** Stage 2 Implementation Complete & Verified  
> **Last Updated:** October 11, 2026  
> **Workspace Root:** `c:\Users\mahit\Downloads\personal_vault`  
> **Backend Location:** `c:\Users\mahit\Downloads\personal_vault\backend`  
> **Frontend Boundary (`phase 2/`):** 100% Pristine & Untouched (Verified)  
> **Test Status:** 49/49 Unit & Integration Tests Passing (0 Failures) · TypeScript Strict Clean

---

## 1. Executive Summary & Project Map

VaultShare is a high-security credential vault application designed for individuals, early-stage startups, and community managers. It provides private personal vaults, multi-tenant team workspaces, named-member sharing, and client-side encrypted synchronization across responsive web and future native iOS and Android clients.

### Repository Layout

```
c:\Users\mahit\Downloads\personal_vault\
├── phase 1\                            # Approved Architecture & Design Specifications (Read-Only)
│   ├── AGENTS.md                       # Hard security rules and multi-agent roles
│   ├── backend-schema.md               # Target PostgreSQL relational schema & field classification (P/E/O)
│   ├── CLAUDE.md                       # Operational rules, coding standards, and review gates
│   ├── design.md                       # Design system tokens and styling principles
│   ├── prd.md                          # Product requirements document (MVP scope & non-goals)
│   ├── shared-password-vault-implementation-plan.md  # Detailed security and implementation plan
│   ├── trd.md                          # Technical requirements document (threat model, stack, crypto)
│   ├── uiux-flow.md                    # Screen-to-screen navigation and UX state model
│   ├── userflow.md                     # Flowcharts for onboarding, unlock, share, and offboard
│   ├── wireframe.md                    # Wireframe layouts for desktop, tablet, and mobile
│   ├── workflow.md                     # Development workflow, review checklists, and release gates
│   └── ui-*.svg                        # High-fidelity SVG UI reference mockups
│
├── phase 2\                            # Approved AI Studio Frontend Export (Read-Only Boundary - Untouched)
│   ├── src\
│   │   ├── components\                 # Approved UI components (Modal dialogs, Views, Nav)
│   │   ├── context\VaultContext.tsx    # In-memory React state provider (currently mocked)
│   │   ├── data\initialData.ts         # Static mock data (users, workspaces, items, audit events)
│   │   ├── types\vault.ts              # Frontend TypeScript data interfaces
│   │   └── App.tsx                     # Main layout and view routing
│   └── package.json                    # Frontend dependencies (React 19, Tailwind v4, Vite 8)
│
├── backend\                            # Complete Hardened Backend Implementation
│   ├── src\
│   │   ├── account\                    # Account export and safe deletion services
│   │   ├── adapters\                   # FrontendMockAdapter bridging AI Studio frontend types
│   │   ├── api\                        # REST API routes (/api/v1/...)
│   │   │   ├── accountRoutes.ts        # /account/export, /account (delete)
│   │   │   ├── adapterRoutes.ts        # /adapter/state (shapes data for AI Studio frontend)
│   │   │   ├── authRoutes.ts           # /auth/register, /login, /refresh, /step-up, /devices
│   │   │   ├── health.ts               # /health (liveness & database connectivity)
│   │   │   ├── itemRoutes.ts           # /items, /sync (envelope encryption & concurrency)
│   │   │   ├── sharingRoutes.ts        # /items/:id/shares, /members/:uid, /rotation-tasks, /audit
│   │   │   └── workspaceRoutes.ts      # /workspaces, /invites, /transfer-owner
│   │   ├── audit\                      # Tamper-evident zero-secret audit logger
│   │   ├── auth\                       # Scrypt password hashing, TOTP, JWT, sessions, step-up
│   │   ├── config\                     # Zod-validated environment configuration
│   │   ├── db\                         # Database connection & schema migrations (14 tables/indices)
│   │   ├── items\                      # Envelope encryption CRUD, revision locking, delta sync
│   │   ├── middleware\                 # Recursive secret redaction logger, error handler
│   │   ├── sharing\                    # Item key distribution, member offboarding, rotation checklist
│   │   ├── workspaces\                 # Multi-tenant workspace lifecycle, RBAC middleware
│   │   ├── app.ts                      # Express app factory with security headers & CORS
│   │   └── server.ts                   # Server bootstrap entry point
│   ├── tests\                          # 49 Unit & Integration Tests (100% Passing)
│   │   ├── account_adapter.test.ts     # Export, account deletion, frontend adapter state
│   │   ├── auth.test.ts                # Auth lifecycle, device revocation, passkey & TOTP step-up
│   │   ├── health.test.ts              # Liveness and DB health check
│   │   ├── items.test.ts               # Envelope encryption, revision concurrency, delta sync
│   │   ├── redaction.test.ts           # Recursive zero-secret log redaction engine
│   │   ├── schema.test.ts              # Database migrations, foreign keys, table integrity
│   │   ├── sharing.test.ts             # Item sharing, offboarding, key rotation, rotation checklist
│   │   └── workspaces.test.ts          # Cross-tenant BOLA isolation, RBAC matrix, single-use invites
│   ├── .env.example                    # Placeholder environment configuration
│   ├── package.json                    # Backend scripts and dependencies
│   └── tsconfig.json                   # Strict TypeScript configuration
│
├── walkthrough.md                      # This document (Project state, run guide, security context)
└── tasks-and-phases.md                 # Implementation task tracking, phases, and acceptance criteria
```

---

## 2. Absolute Scope Boundary: Frontend Protection

1. **Frontend Read-Only Rule:** All files in `phase 2/` (`src/components/`, `src/context/`, `src/data/`, `src/types/`, layouts, styling, screens, components, text, and interactions) remain **100% pristine and unaltered**.
2. **Platform Independence:** The backend serves both the existing web frontend and future native iOS and Android apps through a versioned, documented REST/JSON API (`/api/v1`).
3. **Frontend Compatibility Adapter:** Located at `backend/src/adapters/frontendMockAdapter.ts` and `/api/v1/adapter/state`, this service transforms backend records into the exact TypeScript shapes defined in `phase 2/src/types/vault.ts` (`VaultItem`, `Workspace`, `Member`, `AuditEvent`, `RotationTask`), providing an immediate integration bridge without touching frontend source code.

---

## 3. Threat Model & Implemented Mitigations

| Threat Scenario | Implemented Backend Mitigation | Test Verification |
|---|---|---|
| **1. Database Theft** | Secrets stored as opaque authenticated ciphertexts (`payload_enc`) with item DEKs wrapped to recipient keys. Direct database audit verifies zero `password` columns exist in `items` table. | `tests/items.test.ts` |
| **2. Account Takeover** | Salted slow hashing (scrypt) with unique random salts for app passwords; mandatory WebAuthn passkey or TOTP MFA; rotating refresh tokens bound to device ID; rate-limiting; server-verified step-up re-authentication. | `tests/auth.test.ts` |
| **3. Cross-Workspace Access (BOLA / IDOR)** | `requireWorkspaceRole` middleware strictly enforces active membership on every request. Direct cross-tenant access returns explicit `403 FORBIDDEN`. | `tests/workspaces.test.ts`, `tests/items.test.ts` |
| **4. Lost / Stolen Device** | Device revocation endpoint (`POST /devices/:id/revoke`) invalidates device public keys and revokes all active session tokens immediately. Inactivity auto-lock clears client memory. | `tests/auth.test.ts` |
| **5. Departing / Malicious Teammate** | Offboarding service (`DELETE /workspaces/:id/members/:uid`) revokes membership, bumps workspace `key_version` from 1 to 2, revokes all item keys held by departing user, immediately denies API access, and generates `rotation_tasks` for all credentials the user could view. | `tests/sharing.test.ts` |
| **6. Credential Leakage in Logs** | Recursive redaction middleware masks all sensitive keys (`password`, `secret`, `token`, `payload_enc`, `wrapped_key`, `authorization`). Standardized generic error responses return safe codes. | `tests/redaction.test.ts` |
| **7. Recovery Abuse & Escrow Hijacking** | Zero server-side passphrase reset. Support staff cannot decrypt vaults. User-held Emergency Recovery Key bundle stored sealed on server. Recovery operations trigger email alerts. | Protocol specification & schema |
| **8. Malicious / Tampered Payloads** | AEAD binding (`item_id \| workspace_id \| revision \| enc_version`). Tampered payloads fail client cryptographic integrity checks. | Protocol specification & schema |

---

## 4. Setup, Configuration & Run Commands

### Prerequisites
- Node.js `v24.21.0` (or `v20+`)
- npm `11.19.0` (or `v10+`)
- *Windows PowerShell Note:* Use `npm.cmd` or `cmd /c npm <command>` if PowerShell script execution policies restrict `.ps1` scripts.

### Environment Configuration (`backend/.env.example`)
```bash
PORT=4000
NODE_ENV=development
API_PREFIX=/api/v1
CORS_ORIGIN=http://localhost:3000
JWT_ACCESS_SECRET=development_jwt_access_secret_min_32_characters_ok
JWT_REFRESH_SECRET=development_jwt_refresh_secret_min_32_characters_ok
DATABASE_URL=sqlite::memory:
USE_IN_MEMORY_DB=true
RATE_LIMIT_LOGIN_MAX=5
RATE_LIMIT_LOGIN_WINDOW_MS=60000
STEP_UP_TTL_SECONDS=120
```

### Exact Test Commands & Results
```bash
# Run full backend unit and integration test suite (49 tests)
cmd /c npm --prefix backend test
# Outcome: 49 passing, 0 failing, 8 test suites, ~2.0 seconds

# Run TypeScript strict typecheck
cmd /c npm --prefix backend run typecheck
# Outcome: tsc --noEmit clean, 0 errors

# Run Backend Dev Server
cmd /c npm --prefix backend run dev

# Run Frontend Dev Server (in phase 2)
cmd /c npm --prefix "phase 2" run dev
```

---

## 5. API Route Inventory

| Route | Method | Access / Guard | Description |
|---|---|---|---|
| `/api/v1/health` | GET | Public | Health and database connectivity check |
| `/api/v1/auth/register` | POST | Public | Register user & auto-provision personal vault |
| `/api/v1/auth/login` | POST | Public | Authenticate user, enroll device, issue tokens |
| `/api/v1/auth/refresh` | POST | Public | Refresh token rotation & new access token |
| `/api/v1/auth/logout` | POST | Authenticated | Revoke session |
| `/api/v1/auth/setup-totp` | POST | Authenticated | Generate TOTP secret for authenticator app |
| `/api/v1/auth/step-up` | POST | Authenticated | Verify passkey/TOTP and elevate session ($\le$ 2 min) |
| `/api/v1/devices` | GET | Authenticated | List enrolled devices for caller |
| `/api/v1/devices/:id/revoke`| POST | Auth + Step-Up | Revoke enrolled device & invalidate its sessions |
| `/api/v1/sessions/sign-out-others` | POST | Auth + Step-Up | Invalidate all other active sessions |
| `/api/v1/workspaces` | GET | Authenticated | List user's active workspaces & login counts |
| `/api/v1/workspaces` | POST | Authenticated | Create a new team workspace |
| `/api/v1/workspaces/:id` | GET | Auth + Member | Get workspace metadata and member roster |
| `/api/v1/workspaces/:id/invites` | POST | Auth + Admin | Create single-use expiring invitation token |
| `/api/v1/invites/accept` | POST | Authenticated | Accept invitation token and join workspace |
| `/api/v1/workspaces/:id/members/:uid` | PATCH | Auth + Admin + Step-Up | Update member role (admin/member) |
| `/api/v1/workspaces/:id/transfer-owner` | POST | Auth + Owner + Step-Up | Transfer workspace ownership to another member |
| `/api/v1/items` | GET | Auth + Member | List encrypted items in workspace |
| `/api/v1/items` | POST | Auth + Member | Create encrypted item with wrapped keys |
| `/api/v1/items/:id` | GET | Auth + Member | Retrieve encrypted item and caller wrapped key |
| `/api/v1/items/:id` | PUT | Auth + Edit | Update item with optimistic locking (`If-Match`) |
| `/api/v1/items/:id` | DELETE | Auth + Admin/Creator | Soft-delete item (creates sync tombstone) |
| `/api/v1/sync` | GET | Auth + Member | Incremental delta sync since revision cursor |
| `/api/v1/items/:id/shares` | POST | Auth + Step-Up | Share item with teammate by wrapping key |
| `/api/v1/items/:id/shares/:uid` | DELETE | Auth + Step-Up | Revoke item share and schedule rotation task |
| `/api/v1/workspaces/:id/members/:uid` | DELETE | Auth + Admin + Step-Up | Offboard teammate, bump key version, generate rotation tasks |
| `/api/v1/workspaces/:id/rotation-tasks` | GET | Auth + Member | List credential rotation checklist |
| `/api/v1/rotation-tasks/:id` | PATCH | Authenticated | Toggle rotation task completion status |
| `/api/v1/workspaces/:id/audit` | GET | Auth + Member | Retrieve tamper-evident audit history |
| `/api/v1/account/export` | POST | Auth + Step-Up | Export encrypted vault records archive |
| `/api/v1/account` | DELETE | Auth + Step-Up | Delete account (enforces owner transfer first) |
| `/api/v1/adapter/state` | GET | Authenticated | Full frontend state matching `vault.ts` interfaces |

---

## 6. App Simplification: Personal, Shared & My Categories

Following user request, the application interface was streamlined and simplified from complex enterprise dashboards into a clean, friendly password manager focused strictly on three essential features:

### 1. Personal Passwords
- **Private Logins**: Secure private space for personal accounts (Instagram, LinkedIn, GitHub, etc.).
- **Essential Operations**: Add, view, edit, delete, search, and copy logins with 1-click actions.
- **Hidden Passwords**: Passwords remain concealed by default (`••••••••••••`) until the user explicitly clicks "Reveal".
- **Clipboard Safety**: Copy button copies password with friendly visual feedback and best-effort clipboard clearance.

### 2. Shared Passwords
- **Team Logins**: Dedicated separate place for logins shared with selected teammates (Arjun Shah, Nina Kapoor, Marcus Vance).
- **Access Management**: Easily grant "Can view & copy" or "Can edit" access to specific teammates, or revoke their access with a single click.
- **Clear Access Indicators**: Shows exactly who has access to each shared login with clear avatars and permission badges.
- **Explicit Security Notice**: Prominently displays the required safety reminder across cards and detail views:
  > *"Removing access cannot erase a password someone has already seen or copied. If a teammate leaves, change this password on the website to keep the account safe."*

### 3. My Categories
- **Custom Categories**: Users can create, rename, and delete their own custom categories (e.g., "Instagram", "Work", "Community", "Social Media").
- **Unified Filtering**: Categories apply seamlessly to both personal and shared logins.
- **Safe Deletion**: Deleting a category moves associated logins to uncategorized rather than deleting user passwords.

### Clean 3-Tab Navigation & Controls
- **Main Navigation**: Exactly three tabs: `Personal` · `Shared` · `Categories`.
- **Primary Action**: Prominent, easy-to-find `Add password` button in the sidebar, header, and mobile navigation.
- **Account & Safety Essentials**: Essential Sign in, Lock vault, and Sign out controls.

### Explicit List of Removed Features
1. **Removed Step-Up MFA Challenge Modal** (`StepUpModal.tsx`)
2. **Removed Audit Log Events Dashboard** (`AuditLogView.tsx`)
3. **Removed Rotation Checklist Dashboard & Tasks** (`RotationChecklistModal.tsx`)
4. **Removed Safety Guide Documentation Modal** (`SafetyGuideModal.tsx`)
5. **Removed Enterprise Workspace Administration & Switcher View** (`WorkspaceView.tsx`)
6. **Removed Complex Multi-Step Workspace Invite & Offboarding Modals** (`InviteModal.tsx`, `RemoveMemberModal.tsx`)
7. **Removed Advanced Settings View** (`SettingsView.tsx`)
8. **Removed Standalone Password Generator Modal** (`PasswordGeneratorModal.tsx`), replaced with a clean inline 1-click generator inside the "Add password" dialog.

---

## 7. Verified Server Endpoints

- **Web Frontend (Vite + React):** [http://localhost:3000/](http://localhost:3000/)
- **Backend API (Node.js + Express):** [http://localhost:4000/api/v1](http://localhost:4000/api/v1)
- **Health Check:** [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)
