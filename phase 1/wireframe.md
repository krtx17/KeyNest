# Wireframes — VaultShare

Low-fidelity ASCII wireframes. Mobile (≈390 px) first, then desktop layout.

## 1. Register
```
+------------------------------+
|  VaultShare                  |
|                              |
|  Step 1 of 5                 |
|  Create your account         |
|  [ Email                  ]  |
|  [ Sign-in password       ]  |
|  (!) Different from your     |
|      vault passphrase        |
|  [ Continue ]                |
|  Already have an account?    |
+------------------------------+
```

## 2. Vault passphrase and recovery key
```
+------------------------------+
|  < Back        Step 4 of 5   |
|  Choose a vault passphrase   |
|  [ Passphrase            ]   |
|  Strength: ▓▓▓▓▓░░ Good      |
|  [ Confirm               ]   |
|  (!) We cannot reset this.   |
|  [x] I understand            |
|  [ Continue ]                |
+------------------------------+

+------------------------------+
|  Step 5 of 5                 |
|  Your recovery key           |
|  XXXX-XXXX-XXXX-XXXX-XXXX    |
|  [ Copy ] [ Print ] [ Save ] |
|  Re-enter to verify:         |
|  [                       ]   |
|  [ Verify and continue ]     |
+------------------------------+
```

## 3. Unlock
```
+------------------------------+
|        (lock icon)           |
|  Unlock your vault           |
|  [ Passphrase            ]   |
|  [ Unlock ]                  |
|  [ Use biometrics ]          |
|  Forgot passphrase?          |
+------------------------------+
```

## 4. Vault home (mobile)
```
+------------------------------+
| ☰  Personal ▾        (+)  ⚙  |
| [🔍 Search vault          ]  |
| Folders: All | Social | Dev   |
|------------------------------|
| ◉ Instagram – brand          |
|   hello@brand.com   [shared] |
| ◉ GitHub – org               |
|   admin-bot          [Team A]|
| ◉ Mailchimp                  |
|   news@brand.com             |
|------------------------------|
| Vault | Workspaces | Gen | ⚙ |
+------------------------------+
```

## 5. Vault home (desktop)
```
+---------+------------------------+-----------------------------+
| Sidebar | List                   | Detail                      |
|---------|------------------------|-----------------------------|
| Personal| [Search            ]   | Instagram – brand           |
| Startup | ◉ Instagram – brand    | URL   https://instagram.com |
| Commun. | ◉ GitHub – org         | User  hello@brand.com [copy]|
| ------- | ◉ Mailchimp            | Pass  ••••••••  [👁] [copy] |
| Folders |                        | Notes ...                   |
| Tags    |                        | Shared with: Ana(View) Raj  |
| Settings|                        | [Edit] [Share] [History]    |
+---------+------------------------+-----------------------------+
```

## 6. Item detail (mobile)
```
+------------------------------+
| < Instagram – brand   ⋮      |
| URL        instagram.com ↗   |
| Username   hello@brand [⧉]   |
| Password   ••••••••••  [👁][⧉]|
| Notes      Recovery email... |
| Workspace  Startup A         |
| Folder     Social            |
| Shared with  Ana (View) +1   |
| [ Share ]   [ Edit ]         |
+------------------------------+
```

## 7. Add / edit login
```
+------------------------------+
| Cancel   Add login   Save    |
| Service   [              ]   |
| URL       [https://      ]   |
| Username  [              ]   |
| Password  [          ] [⚙]   |
|   ▓▓▓▓▓▓░░ Strong [Generate] |
| Notes     [              ]   |
| Workspace [Personal ▾    ]   |
| Folder    [Social ▾      ]   |
| Tags      [+ tag]            |
+------------------------------+
```

## 8. Password generator
```
+------------------------------+
|  Generated password          |
|  k7#Pq-91xLm@2vTr      [⧉]   |
|  Length  [====|-----] 20     |
|  [x] A-Z [x] a-z [x] 0-9 [x]!|
|  [ Regenerate ] [ Use ]      |
+------------------------------+
```

## 9. Workspace and members
```
+------------------------------+
| < Startup A            ⋮     |
| Members (4)         [Invite] |
| Priya  Owner                 |
| Ana    Admin                 |
| Raj    Member     [⋯]        |
| Mina   Invited (expires 2d)  |
|------------------------------|
| Collections: Social, Infra   |
| Audit log  >                 |
+------------------------------+
```

## 10. Share sheet
```
+------------------------------+
| Share "Instagram – brand"    |
| Member    [ Ana ▾        ]   |
| Permission (•) View/Copy     |
|            ( ) Edit          |
|  View/Copy can't stop them   |
|  saving it elsewhere.        |
| Fields shared:               |
| [x] Username [x] Password    |
| [x] Notes    [ ] Recovery    |
| (!) Once viewed, a password  |
|     can't be un-seen.        |
| [ Cancel ]   [ Share ]       |
+------------------------------+
```

## 11. Remove member
```
+------------------------------+
| Remove Raj from Startup A?   |
| We will:                     |
|  ✓ Block future access       |
|  ✓ Sign out his sessions     |
|  ✓ Rotate workspace keys     |
| Raj could view 6 logins.     |
| (!) Change these passwords   |
|     at each service.         |
| [ Cancel ] [ Remove + review]|
+------------------------------+
```

## 12. Rotation checklist
```
+------------------------------+
| Rotate after Raj's removal   |
| ☐ Instagram – brand  [Open]  |
| ☐ GitHub – org       [Open]  |
| ☑ Mailchimp          done    |
| Progress 1/3                 |
+------------------------------+
```

## 13. Security settings
```
+------------------------------+
| Security                     |
| Passkeys / Authenticator  >  |
| Recovery key (verified ✓) >  |
| Devices and sessions      >  |
| Auto-lock       5 min  ▾     |
| Clipboard clear 30 s   ▾     |
| Export vault              >  |
| Delete account            >  |
+------------------------------+
```

## 14. Audit log
```
| Time          | Actor | Action          | Target        | Result |
| 11 Oct 12:10  | Ana   | Shared item     | Instagram     | OK     |
| 11 Oct 11:02  | Priya | Removed member  | Raj           | OK     |
(No secret values ever shown.)
```
