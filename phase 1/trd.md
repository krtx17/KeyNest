# TRD — Technical Requirements Document

Version 1.0 · Companion to `prd.md`

> Stack and crypto choices below are **candidates**. The key protocol must be produced and reviewed by a cryptography specialist before implementation. Do not design custom ciphers or protocols.

## 1. Architecture Overview
```
 Web (Next.js SPA)  ┐
                    ├── HTTPS ──> API Gateway ──> Backend services ──> PostgreSQL
 Mobile (RN/Expo)   ┘                              │                   Object store (encrypted backups)
        │                                           └── KMS (operational keys only)
  Shared TS crypto core (reviewed lib: libsodium)
```
Server stores ciphertext, wrapped keys, and minimal metadata. Clients decrypt after vault unlock.

## 2. Proposed Stack
| Layer | Choice | Notes |
|---|---|---|
| Web | Next.js (React, TypeScript), static-leaning, strict CSP | No third-party scripts on vault pages |
| Mobile | React Native (Expo, dev client) + native secure-storage modules | iOS Keychain, Android Keystore |
| Shared | `packages/crypto-core` (TypeScript) | Wraps libsodium; one implementation for all clients |
| Backend | Node.js + TypeScript (Fastify or NestJS) | Modular monolith first |
| DB | PostgreSQL | Row-level checks in service layer; migrations versioned |
| Cache/limits | Redis | Rate limiting, short-lived tokens |
| Auth | WebAuthn passkeys + TOTP; Argon2id for any password hash | SMS never sole MFA |
| Ops keys | Managed KMS | Separate from client vault keys |
| CI/CD | GitHub Actions, signed builds, protected deploy | Pipeline is part of threat model |
| Observability | Structured logs with redaction, metrics, alerts | No secrets, ever |

## 3. Credential Roles (never reuse)
1. **App sign-in credential** — proves identity; Argon2id salted hash if password-based; MFA/passkey.
2. **Vault passphrase** — client-side key derivation only; never sent to server.
3. **Website credentials** — authenticated-encrypted; retrievable after unlock.

## 4. Cryptographic Design (candidate, pending specialist review)
| Concern | Candidate |
|---|---|
| Passphrase KDF | Argon2id, unique salt, parameters benchmarked per device class |
| Item encryption | XChaCha20-Poly1305 (AEAD), random item data key (DEK), versioned |
| Key hierarchy | Account key → device/identity keypair (X25519) → workspace/collection key → item DEK |
| Sharing | DEK/collection key wrapped to recipient public key (sealed box / reviewed key agreement). `view_copy` is advisory: a recipient who can decrypt can copy; only `edit` is server-enforced |
| Rotation | On member removal: new workspace key, rewrap for remaining members, re-encrypt affected records |
| Recovery | Recovery key shown once and verified; any escrow must be disclosed |
| Device enrollment | Existing device approves new device; revocation invalidates server access and triggers rewrap |
| Integrity | Treat all local/synced ciphertext as attacker-modifiable; AEAD + AAD binding item ID, version, workspace |

Deliverable before Phase 3: written protocol spec covering threat assumptions, enrollment, concurrent edits, recovery, revocation, and deletion.

## 5. Threat Model Summary
| Threat | Mitigation | Residual |
|---|---|---|
| Database theft | Client-side encryption, encrypted backups | Metadata exposure |
| XSS / malicious web release | CSP, no inline scripts, SRI, dependency pinning, signed release, 2-person deploy | Delivered JS is in TCB |
| Account takeover | Passkeys/MFA, step-up for sensitive actions, rate limits, new-device alerts | Phishing |
| Lost device | Auto-lock, remote device revoke, key rotation | Unlocked device |
| Malicious teammate | Least privilege, audit, rotation prompts | Cannot erase seen secrets |
| Malware on device | Out of scope; documented | — |
| Insider/support | No plaintext tooling; redacted logs | — |

## 6. API Design
- REST + JSON (OpenAPI), versioned `/v1`.
- Auth: short-lived access token + rotating refresh (HttpOnly, Secure, SameSite cookies on web; secure storage on mobile). CSRF protection for cookie sessions.
- Authorization on **every** request and object: user → workspace membership → role → item/collection grant.
- **Step-up:** sensitive endpoints (sharing changes, member removal, rotation, export, device enrollment, recovery changes, account deletion) require a recent server-verified re-authentication (passkey assertion or TOTP) via `POST /auth/step-up`, which sets `sessions.elevated_until` (≤ 2 min). Otherwise the server returns a step-up-required error. The vault passphrase unlock is verified on the device only and is never a server-side signal.

### Endpoint groups
| Group | Examples |
|---|---|
| Auth | `POST /auth/register`, `/auth/verify-email`, `/auth/passkey/*`, `/auth/totp/*`, `/auth/step-up`, `/auth/refresh`, `/auth/logout` |
| Devices | `GET /devices`, `POST /devices/enroll`, `DELETE /devices/{id}` |
| Vault | `GET /sync?since=`, `POST /items`, `PUT /items/{id}`, `DELETE /items/{id}` |
| Workspaces | `POST /workspaces`, `GET /workspaces/{id}`, `POST /workspaces/{id}/invites` |
| Members | `PATCH /workspaces/{id}/members/{uid}`, `DELETE ...` |
| Sharing | `POST /items/{id}/shares`, `DELETE /items/{id}/shares/{uid}` |
| Keys | `GET /keys/public/{uid}`, `POST /workspaces/{id}/rotate` |
| Audit | `GET /workspaces/{id}/audit` |
| Account | `POST /account/export`, `DELETE /account` |

### Rate limits (initial)
Login 5/min/IP+account, step-up attempts 5/min/session, key-bundle fetch 10/min, invitations 20/hr, exports 3/day, sharing changes 30/hr.

Passphrase unlock attempts happen on the device and cannot be rate limited by the server. Mitigate with client-side exponential backoff, a strong Argon2id cost, and session lock plus full sign-in + MFA after N failures. Server-side limits apply to fetching `key_bundle`/`recovery_bundle` (offline-guessing exposure if a session is stolen).

## 7. Sync
- Per-item version + monotonic server revision; client pulls changes `since` revision.
- Conflict policy: last-writer-wins per field is **not** used for secrets; use optimistic concurrency (`If-Match` revision), conflicting edits produce a client-side merge prompt.
- Soft delete with tombstones; hard purge after retention window.

## 8. Client Security Requirements
- Web: no secrets in localStorage/sessionStorage/IndexedDB/Cache API/service-worker caches; plaintext only in memory; clear on lock/logout; restrictive CSP (`default-src 'self'`, no `unsafe-inline`), Trusted Types where possible; no analytics/session replay.
- Mobile: Keychain/Keystore for device-held secrets; biometrics as local convenience gate only; hide app-switcher preview; auto-lock on background.
- Clipboard: auto-clear after ~30 s (best effort).
- Locks: inactivity default 5 min web, immediate on background mobile (configurable, conservative).

## 9. Non-Functional Targets
| Area | Target |
|---|---|
| Availability | 99.9% API |
| RPO / RTO | 15 min / 4 h |
| Unlock time | < 2 s mid-range phone |
| Sync latency | < 1 s typical |
| Scale (MVP) | 10k users, 1M items |

## 10. Environments and Operations
- Isolated dev / staging / prod; no production data outside prod.
- Least-privilege admin access, hardware-key MFA for operators, break-glass logging.
- Encrypted backups, quarterly restore tests, retention and deletion policy.
- Incident response runbook; vulnerability disclosure policy.

## 11. Testing Strategy
| Type | Scope |
|---|---|
| Unit | Crypto core with known-answer tests, authz rules |
| Integration | Every endpoint × role matrix, cross-tenant access tests |
| E2E | Playwright (web), Detox/Maestro (mobile) for core flows |
| Security | SAST, dependency audit, DAST, independent crypto review, third-party pen test |
| Recovery drills | Device loss, passphrase loss, owner loss, restore from backup |

## 12. Definition of Done (per feature)
Tests pass; authz test added; no secrets in logs/telemetry verified; threat-model delta noted; docs updated.

## 13. Open Technical Decisions
1. Per-item keys vs. per-collection keys.
2. Metadata encryption (searchable plaintext vs. encrypted).
3. Recovery architecture.
4. Hosting provider and region(s).
5. Native vs. cross-platform mobile final call after crypto spike.
