# Shared Password Vault
## Product brainstorm and implementation plan

**Goal:** Build a simple app that works on mobile and web for storing personal and startup/community login credentials, then sharing selected items with teammates when needed.

**Audience:** Individuals with multiple social accounts, small startup teams, and community managers.

> **Security reality:** A password vault is a high-value target. This plan is a design brief, not a security certification. Use reviewed cryptographic components, obtain specialist design and implementation review, and do not store important live credentials until the product has passed independent security testing.

## Review corrections in this version

This plan tightens several points that can otherwise create false confidence:

- “Zero knowledge” cannot be guaranteed merely because encryption happens in a client app. A web server that can change the JavaScript delivered to users could deliver code that captures a vault passphrase or plaintext. The product must state its threat limits and protect the web release pipeline as part of its security design.
- Revoking a teammate cannot erase a password that they already saw, copied, photographed, or retained on a device. It can block future server access; rotate the actual service password when exposure matters.
- Browser storage, including IndexedDB and non-extractable browser keys, is not automatically safe from device access or malicious scripts. Avoid persistent plaintext; treat XSS prevention and secure release controls as core vault protections.
- Account recovery and team sharing require a real, reviewed key protocol. “Use wrapped keys” alone is not a complete design. Do not improvise key derivation, recovery, or team key distribution.
- Copy-to-clipboard clearing and screenshot prevention are best-effort platform features, not guarantees.
- MFA for signing in to this app does not, by itself, encrypt the vault or protect a device that is already unlocked.

## 1. Product concept

A password manager with two clear areas:

- **Personal vault:** Only the individual user can access it.
- **Team workspaces:** Selected items are shared with invited members of a startup or community.

The simplest useful flow is: **find an account → unlock → reveal/copy → share or revoke access**.

### Core features

1. Store service name, login URL, username/email, password, and optional notes.
2. Group entries by workspace, folder, or tag, such as “Personal,” “Startup A,” and “Community.”
3. Search locally after encrypted data is unlocked.
4. Generate strong unique passwords.
5. Share an item or collection with named workspace members and a clear permission level.
6. Revoke access, remove members, and review a history of security-relevant actions.
7. Sync encrypted records between web and mobile.
8. Export or delete an account through a clearly explained flow.

### Keep the first release small

**MVP:** Account registration, app sign-in MFA, vault passphrase, personal vault, small workspaces, logins, folders/tags, search, password generation, copy/reveal, named-user sharing, membership controls, recovery, encrypted sync, audit events, and account deletion.

**Defer:** Browser autofill extension, automatic form filling, passkey credential storage, file attachments, breach monitoring, automatic password rotation, public share links, enterprise SSO/SCIM, and payment-card/identity-document storage. Add these only after the core vault is secure and reviewed.

When a social platform offers role-based business access, guide users to use that instead of sharing one account password. A vault can manage access to a shared login; it cannot provide the platform’s fine-grained roles.

## 2. User journeys

### Create an account and vault

1. Register and verify the account email.
2. Set up a passkey and/or authenticator-app MFA for app sign-in.
3. Choose a separate, strong vault passphrase. Explain that the passphrase protects vault encryption and may not be reset by support.
4. Configure and verify the recovery method before saving important secrets.
5. Create a personal vault or accept a team invitation.

### Save and use a login

1. Choose “Add login.”
2. Enter service name, exact website URL, username, password, and optional notes.
3. Save; show the user which workspace will contain the item.
4. Search and open an item later. Keep the password hidden until the user explicitly reveals or copies it.
5. Require unlock or re-authentication for revealing, exporting, or changing sensitive settings.

### Share with a teammate

1. Choose an item or collection and tap “Share.”
2. Select an existing, verified workspace member.
3. Choose the minimum permission needed: **view/copy** or **edit**.
4. Review the exact fields shared, including notes and recovery information.
5. Confirm. Notify the recipient without including the secret.
6. Remove access when it is no longer needed. Explain that a previously viewed secret may need to be changed at the service itself.

### Leave or remove a teammate

- Disable future workspace access promptly and invalidate that member’s active sessions/tokens.
- Rewrap/rotate workspace access keys using a reviewed protocol; determine which records need re-encryption.
- Identify credentials the member could have viewed and recommend rotating those credentials where appropriate.
- Transfer workspace ownership before deleting an owner account.
- Keep an audit event that records the action and actor, but never the credential value.

## 3. Security model and decisions

### Distinguish three separate credentials

1. **App sign-in credential:** Proves identity to the app. If password-based, store only a salted, slow password hash (Argon2id is a common OWASP recommendation); never reversible-encrypt it. Support MFA/passkeys.
2. **Vault passphrase:** Used in the client-side key design to unlock/decrypt vault data. Do not send or store it as a server-readable credential.
3. **Website credentials:** The actual social/startup logins. These must be encrypted for storage and decrypted only for authorized use; hashing is unsuitable because users need to retrieve them.

Never encourage reuse of the same password across these roles.

### Client-side encryption and honest claims

For the intended privacy model, vault content is encrypted on the user’s device before upload. The server stores ciphertext and only the minimum metadata needed for sync, billing, and access control. The web/mobile clients decrypt after successful vault unlock.

The cryptographic design must specify and be reviewed for:

- Password-based key derivation with unique salt and benchmarked parameters.
- Random data-encryption keys, authenticated encryption, correct nonce handling, and key versioning.
- Separation of user, device, item, and workspace keys.
- How sharing distributes access without exposing plaintext to the service.
- Device enrollment, lost-device revocation, key rotation, backup, recovery, and deletion.
- What metadata the server can see. Service names, URLs, usernames, and team membership can be sensitive even when passwords are encrypted.

Use a maintained, reviewed cryptographic library and standard authenticated-encryption algorithms; do not design a custom cipher or protocol. OWASP guidance provides a starting point, but it does not replace a cryptographic design review.

**Threat statement:** Client-side encryption can reduce the damage from a database-only breach. It does not protect a vault from malware or a compromised/unlocked device, malicious scripts executing in the web app, phishing, a malicious teammate, or a compromised app release. A browser app’s delivered JavaScript is part of the trusted computing base. Protect code signing/build and deployment access, minimize third-party scripts, use a strict Content Security Policy, and review every release. Describe these limits in user-facing security documentation.

Only claim “end-to-end encrypted” or “zero knowledge” after an independent reviewer confirms that ordinary service operations, support tools, telemetry, backups, and recovery cannot access plaintext or decryption keys. State the exact scope and limitations of any such claim.

### Key hierarchy and sharing

A specialist should produce the actual protocol. At a conceptual level:

- Each user/device has an identity key pair generated on a trusted client; private key material is protected on that device and never sent in plaintext to the server.
- Each vault item or collection is encrypted with a random data key.
- For authorized recipients, the relevant data key is securely wrapped for that recipient using a reviewed public-key/key-agreement construction.
- The server stores encrypted payloads and wrapped keys and enforces membership/authorization checks.
- When membership changes, the system blocks future access and rotates/rewraps keys as appropriate. Previously downloaded ciphertext and secrets already viewed cannot be recalled.

Do not implement this outline directly without a protocol review. Define how multi-device enrollment works, how old devices are revoked, how concurrent edits are reconciled, and whether each item has an independent key or belongs to a collection key.

### Recovery

Recovery is a deliberate tradeoff:

- If only the user knows the vault passphrase and no recovery key exists, losing the passphrase can make data unrecoverable.
- If recovery can restore decryption without user-held material, some recovery authority or additional trust mechanism exists and must be disclosed.
- For team data, specify an owner-loss/owner-transfer method that does not quietly create a server decryption backdoor.
- Test recovery and key rotation with real device-loss scenarios before launch.

Do not make recovery sound guaranteed until its protocol is implemented and independently reviewed. Explain the consequences plainly before users rely on the vault.

### Revocation limits

Removing a user from a workspace prevents future authorized access through the service. It cannot erase a password or plaintext the user already copied, memorized, photographed, exported, or downloaded. For shared high-impact accounts, rotate the website password and any exposed recovery/MFA codes after offboarding. Make that action easy to understand and track.

### Mobile and web device protection

- Use iOS Keychain and Android Keystore for device-held secrets; use biometric unlock only as a local convenience gate backed by platform security.
- On the web, do not store plaintext secrets or long-lived session tokens in localStorage/sessionStorage. Avoid persistent plaintext in IndexedDB, Cache API, service-worker caches, browser logs, or downloaded files.
- Browser key storage and non-extractable keys reduce some exposure but do not defeat same-origin malicious JavaScript or a compromised device.
- Lock the vault after inactivity and when the app backgrounds, with configurable but conservative defaults.
- Clear clipboard contents after a short interval where supported, while telling users that other apps/OS behavior may prevent reliable clearing.
- Hide app switcher previews where supported. Screenshot blocking is not uniformly enforceable; do not promise it.
- Use HTTPS, secure cookie/session handling, strict CSP, dependency controls, and minimal third-party code. Do not load advertising or session replay scripts on vault pages.

## 4. Architecture proposal

Choose exact frameworks and hosting after confirming team skills; security properties matter more than a fashionable stack.

- **Web client:** Responsive web app. Keep the web deployment pipeline and JavaScript dependencies inside the threat model. Consider not supporting offline vault access in the MVP.
- **Mobile client:** Native apps or a cross-platform framework with native secure-storage integration. Maintain the same reviewed crypto protocol across platforms.
- **Backend:** Identity/session service, workspace and invitation service, encrypted-record sync API, server-side authorization, rate limiting, and audit events.
- **Database:** User identity references, devices/public keys, workspaces, memberships, encrypted records, wrapped keys, invitations, minimal sync metadata, and audit events.
- **Operational key service:** Managed key vault/KMS for service keys such as database/backup encryption keys. These operational keys are separate from client vault keys and do not decrypt vault records.
- **Operations:** Encrypted backups, isolated dev/staging/production, least-privilege admin access, monitoring with redaction, incident response, and tested restoration.

Conceptual record categories (not a final schema):

- User identity and MFA/passkey references.
- Device enrollment state and public keys.
- Workspace and membership roles.
- Encrypted item payload, nonce, key/version metadata, and minimal sync metadata.
- Recipient-wrapped item/collection keys.
- Audit event: actor, action, target ID, time, outcome; no secret values.

Decide deliberately which metadata is encrypted. If service names and usernames are plaintext for server search, call that out as a privacy limitation. Local search over decrypted client data is a simpler initial option.

## 5. Security requirements

### Data and application protections

- TLS in transit; encryption at rest for database, backups, and logs.
- Authenticated encryption for vault contents, robust key separation, unique random values where required, and versioned migration/rotation.
- No secrets in logs, analytics, crash reports, notification text, URLs, support tools, or test fixtures.
- No raw secrets in persistent browser storage or service-worker caches. Treat local encrypted records as attacker-modifiable input.
- Minimize plaintext lifetime in memory; clear views on lock/logout and avoid copying secrets unnecessarily.
- Secure headers including a restrictive CSP; output encoding and input validation; CSRF protection where cookie sessions require it; secure, HttpOnly, SameSite cookies or an appropriately reviewed BFF design.
- No third-party analytics/session-replay code in authenticated vault views.
- Managed secret storage for operational keys; no keys hard-coded in code or build artifacts.
- Backups encrypted, access-controlled, restore-tested, and governed by retention/deletion rules.

### Sign-in, sessions, and sensitive actions

- Offer passkeys and authenticator-app MFA; make recovery factors explicit. SMS should not be the sole MFA method.
- Rate-limit login, unlock attempts where applicable, recovery, invitations, exports, and sharing changes.
- Use short-lived sessions, secure refresh handling, device/session management, and “sign out other devices.”
- Require fresh vault unlock/re-authentication for reveal, export, changing recovery/MFA, adding devices, and changing access.
- Notify users of new devices, recovery, export, membership, and ownership changes without including secrets.
- Use safe recovery responses and avoid account enumeration.

### Authorization and team controls

- Check membership and permission on every server request and every object. Never trust the client to enforce workspace boundaries.
- Test search, sync, export, invitation, key retrieval, and delete endpoints for cross-tenant access.
- Start with roles **Owner**, **Admin**, and **Member**, plus explicit per-item/collection access. Avoid broad implicit access.
- Make invitations single-use, short-lived, and bound to the intended verified identity.
- Log security events, not secret reads in a way that exposes values; clearly document what access is audited.
- Specify owner transfer, member offboarding, workspace deletion, key rotation, and stale-device behavior.

## 6. Phased implementation plan

### Phase 0 — Discovery and threat model

- Interview individual users and small startup/community teams.
- Confirm common account types, team sizes, sharing needs, supported devices, and recovery expectations.
- Model threats: database theft, account takeover, XSS/malicious web release, lost device, malware, phishing, insider/departing teammate, insecure clipboard, and forgotten recovery material.
- Decide exact privacy claim, metadata exposure, offline behavior, and operational support access.

**Deliverable/exit:** Agreed scope, abuse cases, threat model, and documented recovery/offboarding expectations.

### Phase 1 — UX and cryptographic design

- Prototype create/unlock, add/find/copy, share/revoke, invite, recover, offboard, and delete flows.
- Specify the key hierarchy/protocol, device enrollment, sync conflict handling, recovery, and revocation behavior.
- Document every field as plaintext, encrypted, or operational metadata.
- Get independent cryptographic architecture review before locking the protocol.

**Deliverable/exit:** User-tested UX and reviewed written design. No production secret data yet.

### Phase 2 — Secure foundation

- Implement verified registration, MFA/passkeys, sessions, device management, workspace roles, and API authorization.
- Build production-safe secrets management, logging redaction, monitoring, backups, and separate environments.
- Add authorization tests for every API object and operation.

**Deliverable/exit:** Cross-workspace access checks pass; no secrets in logs/telemetry; session controls and abuse throttles operate correctly.

### Phase 3 — Personal vault

- Implement client-side encryption, key versioning, lock/unlock, create/edit/delete, folders, local search, password generator, reveal/copy, encrypted sync, recovery, and export.
- Add web and mobile secure-storage behavior and background locking.
- Review browser persistence, CSP, XSS defenses, dependencies, and delivery pipeline.

**Deliverable/exit:** Independent review confirms encrypted records/backups do not contain plaintext secrets; device loss, recovery, logout, sync conflicts, and rotation have been exercised.

### Phase 4 — Team sharing

- Add workspace creation, invitations, member lifecycle, item/collection permissions, wrapped-key distribution, audit events, revocation, ownership transfer, and offboarding.
- Add prompts for service credential rotation after a member leaves or access is suspected exposed.
- Test stale sessions, stale devices, concurrent membership changes, and previously downloaded ciphertext.

**Deliverable/exit:** No unresolved critical/high authorization or cryptographic findings; revocation behavior and its limits are clear in product copy.

### Phase 5 — Responsive web and mobile readiness

- Complete accessible phone, tablet, and desktop layouts.
- Validate native secure storage, biometric convenience unlock, background lock, and clipboard handling on real devices.
- Test network interruption, updates, restore, supported browsers/OS versions, and session expiration.

**Deliverable/exit:** Core flows work consistently on supported platforms; platform limitations are documented rather than promised away.

### Phase 6 — Private beta and release

- Beta with test accounts and non-critical credentials first.
- Conduct independent penetration testing and remediate findings.
- Rehearse backup restore, incident response, compromised-account response, recovery, owner transfer, key rotation, and deletion.
- Publish plain-language security, privacy, recovery, and deletion documentation.
- Start with a small user cohort and a clear way to report vulnerabilities.

**Release gate:** No unresolved critical/high findings, tested recovery/restore, usable export/deletion, and evidence that users understand sharing and recovery consequences.

## 7. Acceptance checklist

- [ ] App sign-in passwords are salted and hashed; stored website passwords are authenticated-encrypted and retrievable only after authorized unlock.
- [ ] The actual privacy claim matches verified behavior, including web code delivery, support access, metadata, recovery, telemetry, and backups.
- [ ] Cryptographic design and implementation have independent review.
- [ ] MFA/passkeys, session/device revocation, rate limiting, and fresh authorization for sensitive actions work.
- [ ] Every API endpoint enforces workspace, item, and role permissions.
- [ ] Named-user sharing, revocation, offboarding, ownership transfer, and service-password rotation guidance work.
- [ ] Recovery is tested and its loss/permanence tradeoff is clearly explained.
- [ ] No secrets appear in logs, analytics, notifications, error responses, cache, or support tools.
- [ ] Browser XSS/release risks and mobile local-storage risks are addressed and tested.
- [ ] Backups are encrypted, restore-tested, and subject to clear retention/deletion rules.
- [ ] Independent penetration test findings are remediated before real credentials are invited.
- [ ] UI explains that revocation cannot erase secrets previously seen or copied and clipboard/screenshot protections are limited.

## 8. Recommendation

Build the MVP as a focused password manager: **personal vault + small named-member workspaces + secure encrypted sync**. Start with login records, folders, local search, password generation, MFA, recovery, and auditable sharing. Do not start with autofill extensions or public share links.

Client-side encryption and team sharing are feasible, but the key protocol, recovery system, web release pipeline, and offboarding behavior are the hard parts. If specialist review and ongoing security maintenance are not available, use an established password manager for real credentials while validating the workflow, or keep this app as a prototype with fake data.

## References

- OWASP, [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) — hashing app sign-in passwords.
- OWASP, [Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) and [Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html) — storage and key lifecycle.
- OWASP, [HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) — browser storage and service-worker risks.
- OWASP, [Cross-Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) and [Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html) — browser defenses.
- OWASP, [Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html) and [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- NIST, [SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) — current digital identity guidance, including password-manager and autofill support.
- MDN, [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — browser cryptography caveats; low-level primitives do not remove the need for expert system design and review.

