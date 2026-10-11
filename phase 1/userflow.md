# User Flows — VaultShare

Flows use Mermaid; render in any Markdown viewer that supports it.

## 1. Onboarding: Create account and vault
```mermaid
flowchart TD
  A[Open app] --> B[Register email + sign-in credential]
  B --> C[Verify email]
  C --> D[Set up passkey and/or authenticator MFA]
  D --> E[Choose separate vault passphrase]
  E --> F{Understands passphrase can't be reset by support?}
  F -- No --> E
  F -- Yes --> G[Generate recovery key]
  G --> H[User saves recovery key]
  H --> I[Verify recovery key]
  I --> J{Verified?}
  J -- No --> H
  J -- Yes --> K[Create personal vault or accept team invite]
  K --> L[Empty vault home]
```

## 2. Unlock
```mermaid
flowchart TD
  A[Open app] --> B{Session valid?}
  B -- No --> C[Sign in + MFA]
  B -- Yes --> D{Vault locked?}
  C --> D
  D -- Yes --> E[Enter passphrase or biometric on mobile]
  E --> F{Correct?}
  F -- No --> G[Retry with client-side backoff]
  F -- Yes --> H[Decrypt keys in memory]
  D -- No --> H
  H --> I[Vault list]
```

## 3. Add a login
```mermaid
flowchart TD
  A[Tap Add login] --> B[Enter service, exact URL, username]
  B --> C{Generate password?}
  C -- Yes --> D[Generator: length, charset, preview]
  C -- No --> E[Type or paste password]
  D --> F[Optional notes]
  E --> F
  F --> G[Choose workspace / folder / tags]
  G --> H[Show target workspace summary]
  H --> I[Save: encrypt on device]
  I --> J[Upload ciphertext + metadata]
  J --> K[Item appears in list]
```

## 4. Find, reveal, copy
```mermaid
flowchart TD
  A[Search or browse] --> B[Open item, password hidden]
  B --> C{Action}
  C -- "Reveal / Copy" --> D{Recently unlocked?}
  D -- No --> E[Re-enter passphrase, checked on device]
  D -- Yes --> F[Show or copy]
  E --> F
  F --> G[Auto-hide / clipboard clear timer]
  C -- Edit --> H[Edit form, save]
```

## 5. Invite a teammate to a workspace
```mermaid
flowchart TD
  A["Workspace > Members > Invite"] --> B[Enter email, choose role]
  B --> C[Single-use short-lived invite sent, no secrets]
  C --> D[Recipient opens link, signs in, verifies identity]
  D --> E[Recipient device publishes public key]
  E --> F[Admin confirms member fingerprint]
  F --> G[Member active]
```

## 6. Share an item
```mermaid
flowchart TD
  A["Item > Share"] --> B[Pick verified member]
  B --> C["Pick permission: View/Copy (advisory) or Edit (server-enforced)"]
  C --> D[Review exact fields shared incl. notes]
  D --> E[Step-up: re-authenticate with passkey or MFA]
  E --> F[Wrap item key for recipient]
  F --> G[Confirm]
  G --> H[Notify recipient, no secret in message]
  H --> I[Audit event recorded]
```

## 7. Revoke / remove teammate
```mermaid
flowchart TD
  A[Member settings] --> B[Remove access or remove member]
  B --> C[Step-up with passkey or MFA + confirm]
  C --> D[Server blocks future access, kills sessions]
  D --> E[Rotate workspace keys, rewrap for remaining members]
  E --> F[List credentials member could view]
  F --> G[Warn: seen secrets cannot be erased]
  G --> H[Prompt: rotate passwords at the service]
  H --> I[Track rotation tasks]
  I --> J[Audit event]
```

## 8. Recovery
```mermaid
flowchart TD
  A[Forgot passphrase] --> B[Sign in + MFA]
  B --> C[Enter recovery key]
  C --> D{Valid?}
  D -- Yes --> E[Set new passphrase, rewrap keys]
  E --> F[Issue new recovery key]
  D -- No --> G[Explain permanence; no server backdoor]
  G --> H[Option: create new empty vault]
```

## 9. Add a new device
```mermaid
flowchart TD
  A[New device sign-in] --> B[MFA]
  B --> C[Device generates keypair]
  C --> D[Existing device approves, compares code]
  D --> E[Keys wrapped to new device]
  E --> F[Alert sent to all devices]
```

## 10. Offboarding owner and deletion
```mermaid
flowchart TD
  A[Delete account] --> B{Owns workspaces?}
  B -- Yes --> C[Transfer ownership first]
  B -- No --> D[Offer export]
  C --> D
  D --> E[Step-up with passkey or MFA + confirm]
  E --> F[Delete data, schedule backup purge]
```

## 11. Edge cases
| Case | Behavior |
|---|---|
| Offline on mobile | Read cached encrypted data only after unlock; edits queued with revision check |
| Concurrent edit | Conflict prompt with both versions |
| Revoked device | Next request rejected; local data wiped on app open |
| Invite expired/used | Clear error, admin may resend |
| Failed unlock x N | Client-side backoff on the device (the server never sees passphrase attempts); after N failures, lock the session and require full sign-in + MFA again |
| Sensitive action without recent step-up | Server rejects with a step-up-required response; client prompts passkey/MFA, then retries |
