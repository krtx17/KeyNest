# Design System — VaultShare

## 1. Brand Feel
Calm, trustworthy, clear. Security without fear-mongering. Quiet interface, strong hierarchy, generous spacing.

## 2. Color Tokens
| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #FFFFFF | #0E1116 | Page background |
| `--surface` | #F5F7FA | #161B22 | Cards, panes |
| `--border` | #DDE3EA | #2A313B | Dividers |
| `--text` | #0F1720 | #E6EDF3 | Primary text |
| `--text-muted` | #566170 | #9AA7B4 | Secondary |
| `--primary` | #1F5FE0 | #5B8DEF | Primary actions |
| `--primary-contrast` | #FFFFFF | #0E1116 | Text on primary |
| `--success` | #1A7F4B | #3FB27F | Verified, strong |
| `--warning` | #A15C00 | #E3A64A | Weak/reused, caution |
| `--danger` | #C62828 | #F2706B | Remove, delete |
| `--focus` | #1F5FE0 | #9DB9F5 | Focus ring (2 px) |

All text/background pairs must meet WCAG AA.

## 3. Typography
| Role | Font | Size / Line | Weight |
|---|---|---|---|
| Display | Inter | 28 / 36 | 600 |
| H1 | Inter | 22 / 30 | 600 |
| H2 | Inter | 18 / 26 | 600 |
| Body | Inter | 16 / 24 | 400 |
| Small | Inter | 14 / 20 | 400 |
| Mono (passwords) | JetBrains Mono | 15 / 22 | 500 |

Self-host fonts (no third-party font requests on vault pages).

## 4. Spacing, Radius, Elevation
- Spacing scale: 4, 8, 12, 16, 24, 32, 48.
- Radius: 8 (inputs, buttons), 12 (cards), 999 (chips).
- Elevation: border-first; shadows only on sheets/modals (`0 8px 24px rgba(0,0,0,.12)`).
- Page gutter: 16 mobile, 24 tablet, 32 desktop.

## 5. Components
| Component | Spec |
|---|---|
| Button | Primary / Secondary / Ghost / Destructive; 44 px min height; loading spinner replaces label width-safe |
| Input | 48 px height, label above, helper and error text; password input has reveal + paste |
| Password field | Mono font; hidden by default; auto-hide after 20 s; copy button with toast |
| Strength meter | 4 segments + text label (not colour only) |
| Item row | Favicon/initial avatar, title, username, badges (Shared, Team, Weak) |
| Badge | Neutral, Success, Warning, Danger |
| Toast | Bottom on mobile, top-right desktop; 4 s; no secret content |
| Modal / Sheet | Bottom sheet on mobile, centered dialog desktop; focus trap |
| Confirm dialog | Destructive: states consequences, typed confirmation for delete account/workspace |
| Banner | Info / Warning / Offline; dismissible except security-critical |
| Empty state | Illustration-light, one CTA |
| Tabs / Bottom nav | 4 items max, labels always visible |
| Table (audit) | Sticky header, zebra optional, responsive collapse to cards |

## 6. Iconography
Outline icon set (Lucide), 20/24 px, 1.5 px stroke. Lock, eye, copy, share, users, shield, key, alert.

## 7. Motion
- 150–200 ms ease-out for transitions; no motion on lock/unlock beyond fade.
- Respect `prefers-reduced-motion`.

## 8. Security-Relevant UI Rules
1. Never render secrets in page `<title>`, URLs, notifications, or toasts.
2. Disable autocomplete/spellcheck on secret fields; `autocomplete="off"` for vault passphrase, `new-password` where appropriate.
3. Blur/hide content on app background; mask app-switcher preview where supported.
4. Do not load third-party scripts, fonts, or analytics on authenticated pages.
5. Clipboard actions show timer text only where supported.
6. Warning copy is shown at share, remove, export, and recovery steps.

## 9. Frontend Implementation Notes
| Item | Choice |
|---|---|
| Web styling | Tailwind or CSS variables with the tokens above |
| Component library | Radix primitives (a11y-friendly) + own styling |
| Mobile | React Native with shared tokens package (`packages/design-tokens`) |
| State | Query cache for ciphertext; decrypted view-models kept in memory only, cleared on lock |
| Icons | Lucide |
| Testing | Storybook + visual regression; axe-core a11y checks in CI |

## 10. Token File (shared)
```json
{
  "color": {
    "primary": { "light": "#1F5FE0", "dark": "#5B8DEF" },
    "danger":  { "light": "#C62828", "dark": "#F2706B" }
  },
  "space": [4, 8, 12, 16, 24, 32, 48],
  "radius": { "sm": 8, "md": 12, "pill": 999 },
  "font": { "sans": "Inter", "mono": "JetBrains Mono" }
}
```
