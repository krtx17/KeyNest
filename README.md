# KeyNest — Shared Credential Vault

KeyNest is a focused, easy-to-use credential vault designed for personal accounts and startup/community teams. It provides private personal password storage, team password sharing with granular permissions, and custom categories to organize logins.

---

## 1. Architecture Overview

![Keynest Architecture Overview](docs/images/architecture-overview.svg)

The application consists of a responsive web frontend and a modular REST API backend designed to be platform-independent for future native mobile applications.

---

## 2. Implemented Features

### Personal Passwords
- **Private Vault**: A private place for personal accounts (Instagram, LinkedIn, GitHub, etc.).
- **Full Credential Lifecycle**: Add, view, edit, delete, search, and copy logins with 1 click.
- **Hidden Passwords**: Passwords remain concealed by default (`••••••••••••`) until explicitly revealed.
- **Clipboard Safety**: Copy button copies password with friendly feedback and best-effort clipboard clearance.

### Shared Passwords
- **Team Logins**: A separate, dedicated section for credentials shared with teammates.
- **Access Delegation**: Share logins with specific teammates and choose permissions:
  - `Can view & copy`: Use the login without editing details.
  - `Can edit`: Update login details and credentials.
- **Access Revocation**: Remove a teammate's access at any time with one click.
- **Access Visibility**: Clearly shows all teammates who have access to each shared login.
- **Real-World Security Notice**: Explicit reminder displayed in the UI:
  > *"Removing access cannot erase a password someone has already seen or copied. If a teammate leaves, change this password on the website to keep the account safe."*

### My Categories
- **User-Defined Categories**: Create, rename, and delete custom categories (e.g., *Instagram*, *Work*, *Community*, *Social Media*).
- **Unified Organization**: Categories apply seamlessly to both personal and shared logins.
- **Category Filtering**: Filter logins by category pills in Personal/Shared views or manage them in the Categories tab.
- **Safe Deletion**: Deleting a category moves associated logins to uncategorized rather than deleting user passwords.

### Account & Safety Essentials
- **Passphrase Unlock**: Clean lock screen to protect vault contents on the device.
- **Lock Vault**: One-click lock button in header/sidebar (`Cmd/Ctrl + L`).
- **Sign Out**: Simple sign out control in user profile.

### Hardened Backend REST API
- **Modular Monolith**: Express + TypeScript backend on Node 24 (`/api/v1`).
- **Secret Redaction**: Middleware automatically redacts passwords, tokens, and Authorization headers from logs.
- **Session Authentication**: Salted Scrypt password hashing, JWT access tokens, refresh token rotation, and remote device revocation.
- **Step-Up Elevation Guard**: Sensitive operations require recent re-authentication ($\le$ 2 minute TTL).
- **Tenant Isolation**: Server-side authorization preventing cross-user and cross-workspace object access (BOLA/IDOR protection).

---

## 3. Vault & Cryptographic Data Model

![Keynest Vault Model](docs/images/vault-model.svg)

The backend schema strictly partitions plaintext operational metadata from sensitive secrets:
- **Plaintext Metadata (visible to backend)**: Workspace IDs, Category IDs, item revision numbers, and timestamps.
- **Encrypted Payload (opaque ciphertext)**: Authenticated ciphertext payload (`payload_enc`), unique IV/nonce, encryption version, and key version.
- **Key Envelopes (`item_keys`)**: Item Data Encryption Keys (DEKs) wrapped per recipient user with explicit permissions (`view_copy` vs `edit`). Plaintext passwords are never stored in the database.

---

## 4. Sharing & Revocation Lifecycle

![Keynest Sharing Lifecycle](docs/images/sharing-lifecycle.svg)

1. **Selection & Permission**: Owner selects teammate and assigns `view_copy` or `edit` permissions.
2. **Key Envelope Wrapping**: Item DEK is encrypted for the recipient and stored in `item_keys`.
3. **Client Decryption**: Recipient fetches ciphertext and wrapped key, decrypting locally.
4. **Access Revocation**: Owner removes teammate access $\rightarrow$ wrapped key record is revoked $\rightarrow$ future server sync and reads are blocked.
5. **Security Reality**: Revocation cuts off future access, but software cannot erase what a human has previously seen or copied. The app prompts the owner to rotate the external account password.

---

## 5. Prerequisites

- **Node.js**: v20.x or higher (tested on Node v24.x)
- **npm**: v10.x or higher

---

## 6. Setup, Run & Test Instructions

### Backend (REST API)

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Run 49 unit and integration tests
npm test

# Run strict TypeScript typecheck
npm run typecheck

# Start development server on http://localhost:4000/api/v1
npm run dev
```

Check API health:
```bash
curl http://localhost:4000/api/v1/health
# Returns: {"status":"healthy","version":"1.0.0",...}
```

### Frontend (Web UI)

```bash
# Navigate to frontend directory
cd "phase 2"

# Install dependencies
npm install --legacy-peer-deps

# Build for production
npm run build

# Start Vite development server on http://localhost:3000
npm run dev
```

---

## 7. Project Map

```
personal_vault/
├── backend/                       # Node.js 24 + Express REST API
│   ├── src/                       # Backend source code
│   │   ├── api/                   # Route handlers (/auth, /items, /workspaces, /sharing)
│   │   ├── auth/                  # Scrypt, JWT, TOTP, and session management
│   │   ├── db/                    # SQLite connection & 14-table schema migrations
│   │   ├── items/                 # Item service & revision locking
│   │   ├── middleware/            # Redaction logger, error handling & RBAC
│   │   └── sharing/               # Key envelope distribution & revocation
│   ├── tests/                     # 49 test suites (100% pass)
│   ├── .env.example               # Safe backend environment variables template
│   └── package.json
│
├── phase 1/                       # Architecture, PRD, TRD, and UI reference SVGs
│   ├── trd.md                     # Technical requirements document
│   ├── prd.md                     # Product requirements document
│   └── ui-*.svg                   # UI screen layout design references
│
├── phase 2/                       # React 19 + Vite frontend application
│   ├── src/                       # Frontend source code
│   │   ├── components/            # Clean UI views (VaultHome, CredentialDetail, CategoryView)
│   │   ├── context/               # VaultContext state provider
│   │   ├── data/                  # Initial demo data seeds
│   │   └── types/                 # Shared TypeScript models
│   ├── .env.example               # Safe frontend environment variables template
│   └── package.json
│
├── docs/                          # Documentation assets
│   └── images/                    # Architecture, data model & lifecycle SVG diagrams
│
├── .gitignore                     # Repository-level ignore rules
├── tasks-and-phases.md            # Detailed phase tracking and completion criteria
└── walkthrough.md                 # Complete technical walkthrough and implementation details
```

---

## 8. Current Limitations & Demo Behavior

- **Initial Demo Seed**: For demonstration convenience, the frontend loads realistic sample accounts (Instagram, LinkedIn, GitHub, YouTube, Twitter, Mailchimp) and teammates (Arjun, Nina, Marcus).
- **Database Engine**: The local backend uses `node:sqlite` for zero-dependency execution. PostgreSQL is planned for production deployment.
- **Client-Side Cryptography**: In-memory credential viewing is implemented. Client-side WebCrypto / libsodium integration for zero-knowledge end-to-end device key agreement is planned for subsequent phases.
- **Mobile Clients**: Native iOS and Android apps are planned; the backend API is built platform-independent to support them.

---

## 9. Security Note

- **No Overstated Claims**: KeyNest does not claim third-party security audits, compliance certifications (SOC 2, ISO 27001), or end-to-end zero-knowledge encryption until full client-side crypto review is completed.
- **Zero Plaintext Passwords**: Real website passwords and private keys are never stored in plaintext on the backend or written to logs.
- **Honest Access Boundary**: Revoking access blocks future server reads and sync, but cannot erase credentials already viewed or copied by a recipient.
