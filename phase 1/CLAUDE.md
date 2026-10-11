# CLAUDE.md — Project Instructions for Claude Code (VaultShare)

Claude: read this at the start of every session. Also read `AGENTS.md` (shared hard rules) and the docs listed below before non-trivial work.

## Project Summary
VaultShare is a web + mobile password vault: personal vault, small team workspaces, named-user sharing, client-side encrypted sync. Audience: individuals, small startups, community managers. Security correctness outranks speed.

## Key Docs
| File | Purpose |
|---|---|
| `prd.md` | Product requirements and scope |
| `trd.md` | Architecture, stack, crypto candidates, API |
| `backend-schema.md` | DB tables and field classification |
| `userflow.md`, `wireframe.md`, `uiux-flow.md`, `design.md` | UX and UI |
| `workflow.md` | Dev process, CI/CD, review gates |
| `AGENTS.md` | Hard security rules and agent roles |

## Tech Stack (candidate)
Next.js (web) · React Native/Expo (mobile) · Node + TypeScript (API, Fastify/NestJS) · PostgreSQL · Redis · libsodium via `packages/crypto-core` · WebAuthn + TOTP · managed KMS.

## Commands (update when scripts exist)
```bash
pnpm install            # install deps
pnpm dev                # run web + api locally
pnpm lint && pnpm typecheck
pnpm test               # unit + integration
pnpm test:e2e           # Playwright / mobile E2E
pnpm db:migrate         # run migrations
pnpm audit --prod       # dependency audit
```

## Non-Negotiables
1. **Do not write or modify cryptographic primitives or protocol logic.** Use `packages/crypto-core` only. Protocol changes need an approved spec in `docs/crypto/`.
2. **Never output, log, or commit real secrets.** Use obviously fake data (`example.com`, `P@ssw0rd-FAKE`).
3. **No plaintext secrets in browser storage, caches, logs, URLs, or telemetry.**
4. **Server-side authorization on every request**; add an authz-matrix test with every endpoint.
5. **No unverified security claims** in UI copy or docs.
6. **No third-party scripts** on authenticated pages.
7. Do not weaken tests, CSP, rate limits, or MFA to make something pass.

## How to Work
- For any task bigger than a trivial edit: state a short plan, then implement in small steps.
- Ask before: changing the key protocol, adding server-visible metadata, adding dependencies/SDKs, changing auth flows.
- Match existing conventions; keep diffs focused; explain security-relevant decisions in comments.
- Run lint, typecheck, and tests before declaring done. Report what you ran and the result honestly; if you could not run something, say so.
- Surface risks and open questions in your summary rather than hiding them.

## Code Style
- TypeScript strict; zod validation at boundaries; no `any` without reason.
- Functional, small modules; explicit return types on public functions.
- Error messages to clients are generic; details go to redacted logs.
- Accessibility: semantic HTML, labels, keyboard support, WCAG 2.2 AA.
- UI uses tokens from `design.md` / `packages/design-tokens`.

## Honest UX Copy (must appear where relevant)
- Revocation cannot erase secrets already seen or copied; recommend rotating the service password.
- Clipboard clearing and screenshot hiding are best effort.
- Vault passphrase cannot be reset by support; recovery key must be saved and verified.

## Review Checklist Before Finishing
- [ ] No secrets in code, logs, tests, or fixtures
- [ ] Authz enforced and tested (including cross-tenant)
- [ ] No crypto outside `crypto-core`
- [ ] No new browser persistence of plaintext
- [ ] Lint, typecheck, tests pass
- [ ] Docs updated if behavior changed
- [ ] Items needing human security review are listed
