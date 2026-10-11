# AGENTS.md — Guide for AI Coding Agents (VaultShare)

This file tells any AI coding agent how to work in this repository. Read it fully before changing code. See also `CLAUDE.md`, `trd.md`, `backend-schema.md`, `workflow.md`.

## 1. Mission
Build VaultShare: a password vault for web and mobile with a personal vault, small team workspaces, named-member sharing, and client-side encrypted sync. **Security correctness outranks speed and features.**

## 2. Hard Rules (never violate)
1. **Never invent cryptography.** Use only `packages/crypto-core`, which wraps a reviewed library (libsodium). Do not write ciphers, KDFs, key-wrapping, or nonce logic elsewhere.
2. **Do not change the key protocol, recovery design, or sharing/rotation logic** without an approved spec in `docs/crypto/` and a human security reviewer.
3. **Never log, print, persist, or send plaintext secrets**: passwords, vault passphrase, recovery key, decrypted notes, private keys. This includes tests, fixtures, errors, analytics, crash reports, URLs, and notifications.
4. **Never store plaintext or long-lived tokens in localStorage, sessionStorage, IndexedDB, Cache API, or service-worker caches.**
5. **No third-party scripts, analytics, or session replay** in authenticated vault pages.
6. **No hard-coded keys or secrets.** Use environment/KMS. Never commit `.env` files.
7. **Authorization is server-side on every endpoint and object.** Never trust the client to enforce workspace boundaries.
8. **Do not make security claims** ("zero knowledge", "end-to-end encrypted", "unbreakable", "screenshot-proof") in code, UI copy, or docs unless `docs/security/claims.md` approves them.
9. **Use fake data only** in dev, tests, screenshots, and examples.
10. **Do not weaken** CSP, rate limits, MFA requirements, or auth checks to make a test or demo pass.

## 3. Repository Layout (target)
```
apps/
  web/            Next.js client
  mobile/         React Native (Expo) client
  api/            Backend (TypeScript)
packages/
  crypto-core/    ONLY place for crypto code
  design-tokens/  Shared design tokens
  shared-types/   API types and zod schemas
docs/
  crypto/         Protocol specs (human-approved)
  security/       Threat model, claims, runbooks
infra/            IaC, CI, deployment
```

## 4. Agent Roles
| Agent | Responsibility | May touch | Must not touch |
|---|---|---|---|
| Planner | Break work into tasks, update docs | docs, issues | source code |
| Backend | API, DB, authz, migrations | `apps/api`, `infra` | `crypto-core` internals |
| Web | Web UI, CSP, a11y | `apps/web`, tokens | API authz logic |
| Mobile | Mobile UI, secure storage | `apps/mobile` | `crypto-core` internals |
| Crypto-integration | Calls into `crypto-core`; never modifies primitives | clients | protocol specs |
| Test/QA | Unit, integration, E2E, authz matrices | tests | production logic |
| Security reviewer | Reviews diffs against hard rules | read-only, comments | — |
| Docs | PRD/TRD/user-facing security docs | docs | code |

## 5. Working Procedure
1. Read the relevant docs (`prd.md`, `trd.md`, `backend-schema.md`).
2. Restate the task and list files you will touch.
3. Prefer small, reviewable changes (one concern per PR).
4. Write tests first or alongside: unit, authz-matrix, and where relevant E2E.
5. Run lint, typecheck, tests, and dependency audit locally.
6. Self-review against Section 2 and the checklist in `workflow.md`.
7. Summarize changes, risks, and anything needing human review.

## 6. Coding Standards
- TypeScript strict mode; no `any` without justification.
- Validate all inputs with zod at the API boundary; encode all outputs.
- Errors: generic to clients, detailed to redacted server logs. Avoid account enumeration.
- Dependencies: add only when necessary; pin versions; justify in PR; prefer maintained, widely reviewed packages.
- Naming: clear, descriptive; no secrets in identifiers.
- Comments explain *why*, especially around security decisions.

## 7. Testing Requirements
| Change | Required tests |
|---|---|
| New endpoint | Authz matrix (owner/admin/member/non-member/other tenant), input validation, rate limit |
| Crypto-core change | Known-answer tests, tamper tests, version-migration tests (human review required) |
| UI with secrets | Test that secrets are masked by default and cleared on lock |
| Sync | Conflict and stale-revision tests |
| Sharing/rotation | Revoked user cannot fetch new keys; stale sessions rejected |

## 8. When to Stop and Ask a Human
- Any change to key derivation, wrapping, recovery, device enrollment, or rotation.
- Any new data stored on the server about users, service names, or URLs.
- Any new third-party service or SDK.
- Any ambiguity about what the server may see.
- Failing security tests you are tempted to skip or weaken.

## 9. Definition of Done
- Tests pass, lint/typecheck clean, no new audit highs.
- No secrets in logs/telemetry (verified).
- Docs updated; threat-model delta noted.
- Reviewer sign-off for security-sensitive paths.
