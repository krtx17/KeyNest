# PRD — VaultShare (Shared Password Vault)

> Working name: **VaultShare**. Version 1.0 · Status: Draft for review

> **Security reality:** A password vault is a high-value target. This document is a product brief, not a security certification. Do not store important live credentials until the product has passed independent cryptographic and penetration review.

## 1. Vision
A simple, trustworthy app (web + mobile) to store personal and startup/community logins and share selected items with named teammates, with honest, clearly stated security limits.

## 2. Problem
- People juggle many social/startup accounts with weak or reused passwords.
- Teams share credentials through chat, sheets, and email, with no revocation and no audit trail.
- Existing tools are either too heavy for small teams or hide their real security limits.

## 3. Target Users
| Persona | Needs |
|---|---|
| Individual with many accounts | Store, search, generate, copy quickly |
| Small startup team (2–15) | Share some logins, offboard teammates safely |
| Community manager | Shared social-account logins across volunteers, with an audit trail |

## 4. Goals and Non-Goals
**Goals (MVP)**
1. Secure personal vault.
2. Small workspaces with named-member sharing.
3. Encrypted sync across web and mobile.
4. Clear revoke/offboard flow with honest messaging.

**Non-Goals (deferred)**
Browser autofill extension, automatic form fill, passkey credential storage, file attachments, breach monitoring, automatic password rotation, public share links, enterprise SSO/SCIM, payment-card/ID storage.

## 5. Core Concept
- **Personal vault** — only the owner can access it.
- **Team workspaces** — selected items shared with invited members.
- Core loop: **find account → unlock → reveal/copy → share or revoke**.

## 6. Functional Requirements (MVP)
| ID | Requirement | Priority |
|---|---|---|
| F-01 | Register, verify email | P0 |
| F-02 | App sign-in MFA (passkey and/or TOTP) | P0 |
| F-03 | Separate vault passphrase (not resettable by support) | P0 |
| F-04 | Recovery method configured and verified before saving secrets | P0 |
| F-05 | Create/edit/delete login items (service, URL, username, password, notes) | P0 |
| F-06 | Folders/tags/workspaces | P0 |
| F-07 | Local search over decrypted data | P0 |
| F-08 | Password generator | P0 |
| F-09 | Reveal/copy with explicit action; passphrase re-entry (checked on device) to reveal, and server-verified step-up (passkey/MFA) for sensitive actions | P0 |
| F-10 | Workspaces: create, invite, roles (Owner/Admin/Member) | P0 |
| F-11 | Share item/collection with named verified member; permission view/copy (advisory: a recipient who can view can also copy) or edit (server-enforced) | P0 |
| F-12 | Revoke access, remove member, rotate workspace keys | P0 |
| F-13 | Audit events (no secret values) | P0 |
| F-14 | Encrypted sync web ↔ mobile | P0 |
| F-15 | Export and account deletion | P0 |
| F-16 | Session/device management, "sign out other devices" | P0 |
| F-17 | Auto-lock on inactivity/background; clipboard auto-clear (best effort) | P0 |
| F-18 | Rotation prompts after member removal | P1 |
| F-19 | Owner transfer before owner deletion | P0 |

## 7. Non-Functional Requirements
- **Security:** client-side encryption, authenticated encryption, reviewed crypto library, strict CSP, no third-party analytics on vault pages.
- **Privacy:** minimal server metadata; all plaintext/encrypted/operational fields documented.
- **Reliability:** encrypted backups, restore-tested; sync conflict handling.
- **Accessibility:** WCAG 2.2 AA on core flows.
- **Performance:** unlock < 2 s on mid-range phone (KDF parameters benchmarked); search < 100 ms for 5,000 items.
- **Platforms:** latest 2 versions of Chrome, Safari, Firefox, Edge; iOS and Android supported versions TBD in Phase 0.

## 8. Honest Claims Policy
- Do not claim "zero knowledge" or "end-to-end encrypted" until an independent reviewer verifies support tools, telemetry, backups, recovery, and web code delivery cannot access plaintext or keys.
- UI must state: revocation cannot erase secrets already seen or copied; view/copy permission cannot stop a recipient from saving what they can see; clipboard clearing and screenshot blocking are best effort; MFA for sign-in does not protect an already unlocked or compromised device.

## 9. Success Metrics
| Metric | Target |
|---|---|
| Activation (account + verified recovery + first item) | ≥ 60% of registrants |
| Time to first saved login | < 3 min |
| Beta users who correctly explain recovery and revocation limits | ≥ 80% |
| Critical/high security findings open at release | 0 |
| Weekly retention (beta) | ≥ 40% |

## 10. Release Plan
| Phase | Outcome |
|---|---|
| 0 | Discovery, threat model |
| 1 | UX prototype and reviewed crypto design |
| 2 | Secure foundation (auth, workspaces, authz) |
| 3 | Personal vault |
| 4 | Team sharing |
| 5 | Responsive web and mobile readiness |
| 6 | Private beta, pen test, release gate |

**Release gate:** no unresolved critical/high findings, tested recovery/restore, usable export/deletion, users understand sharing and recovery consequences.

## 11. Risks
| Risk | Mitigation |
|---|---|
| Wrong or improvised crypto protocol | Specialist design + independent review |
| Malicious web release / XSS | Locked pipeline, strict CSP, minimal dependencies, release review |
| Users lose passphrase | Verified recovery key flow, plain-language warnings |
| Offboarded member keeps knowledge of passwords | Rotation prompts; UI honesty |
| Team lacks security maintenance capacity | Prototype with fake data only; use an established manager for real credentials |

## 12. Open Questions
1. Exact recovery model (user-held recovery key vs. threshold/escrow) and its disclosure.
2. Which metadata (service names, URLs) is encrypted vs. server-searchable?
3. Offline vault support on web (MVP: no).
4. Pricing/billing model (billing metadata only; never vault contents).
