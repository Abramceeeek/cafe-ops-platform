# HubSync Design System

**Aesthetic:** clean operational SaaS — neutral slate, single indigo accent, crisp
borders, 8px radius, compact scannable tables. Light + dark via a toggle.

**Stack (web, `apps/admin_web`):** Tailwind CSS v3 + shadcn/ui (new-york) on Radix
primitives, `lucide-react` icons, `next-themes` (class strategy), `sonner` toasts.
Components live in `components/ui/*`; `cn()` helper in `lib/utils.ts`.

## Tokens (HSL — defined in `app/globals.css`, surfaced via `tailwind.config.ts`)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--primary` | `243 75% 59%` (#4F46E5 indigo) | `243 75% 66%` | accent, primary buttons, active nav |
| `--background` | `0 0% 100%` | `222 47% 7%` | page bg |
| `--foreground` | `222 47% 11%` (#0F172A) | `210 40% 96%` | text |
| `--card` | `0 0% 100%` | `222 47% 9%` | surfaces |
| `--muted` / `-foreground` | `210 40% 96%` / `215 16% 47%` | `217 33% 17%` / `215 20% 65%` | subtle bg / secondary text |
| `--border` / `--input` | `214 32% 91%` | `217 33% 20%` | borders, inputs |
| `--destructive` | `0 72% 51%` | `0 63% 45%` | errors, 86 |
| `--radius` | `0.5rem` | — | corner radius |

**Fonts:** Geist Sans (`--font-geist-sans`) / Geist Mono — local, in `app/fonts/`.

## Order-status palette (`components/order-status-badge.tsx`, per spec §7/§11.1D)
- amber → `pending_request`, `specialist_approved`
- blue → `shop_confirmed`, `in_progress`, `packaged`
- orange → `ready_for_courier`, `in_transit`
- green → `delivered`
- red → `rejected`, `cancelled`

## App shell
`components/app-shell.tsx` — left sidebar (role-filtered nav), topbar (role label,
email, theme toggle, sign out). Route group `app/(app)/` carries the shell; `/login`
is standalone.

## Flutter parity (Stage E)
Mirror these tokens in a Flutter `ThemeData`/`ColorScheme` (light + dark): seed the
ColorScheme from indigo `#4F46E5`, reuse the status palette for order chips, 8px
radius, Geist (or Inter fallback). Keep component look consistent, not pixel-identical.
