# HubSync Design System — bobo & wild

**Aesthetic:** warm artisanal-utilitarian. Paper/clay neutrals, **terracotta**
accent, serif display type. **Light** for Shop & Admin, **dark** for the Hub
kitchen displays. Brand: "bobo & wild" (café), "HubSync" (internal platform).

**Stack (web, `apps/admin_web`):** Tailwind CSS v3 + shadcn/ui on Radix,
`lucide-react`, `next-themes` (class strategy), `sonner`. Components in
`components/ui/*`; `cn()` in `lib/utils.ts`. Source design bundle: Claude Design
("HubSync Operations Platform"), `theme.css`.

## Fonts (next/font/google, in `app/layout.tsx`)
- **Newsreader** (`--font-display`, serif) — page titles, brand voice, totals.
- **Hanken Grotesk** (`--font-sans`) — UI, body, controls.
- **IBM Plex Mono** (`--font-mono`) — order IDs, quantities, money, timers.

## Tokens (direct hex in `app/globals.css`, consumed via `var()` in `tailwind.config.ts`)
| Token | Light (shop/admin) | Dark (.dark = Hub) |
|---|---|---|
| `--primary` (terracotta) | `#C2410C` | `#E2703A` |
| `--background` (paper) | `#F4EEE3` | `#16120D` |
| `--foreground` (ink) | `#241D17` | `#F3ECDF` |
| `--card` (surface) | `#FFFFFF` | `#211B14` |
| `--muted` | `#ECE3D4` | `#2A231B` |
| `--muted-foreground` | `#8B7E70` | `#9E9180` |
| `--accent` (terra tint) | `#F8E6D9` | `#3A2519` |
| `--border` | `#E6DCCC` | `#34291E` |
| `--destructive` | `#AE2018` | `#F0796C` |
| `--radius` | `0.875rem` (14px) | — |

Components avoid Tailwind opacity modifiers (`/NN`) since tokens are raw hex —
use the solid tokens (`bg-accent`, `hover:opacity-90`) instead.

## Order-status palette (`components/order-status-badge.tsx`, spec §7/§11.1)
Status pill = dot + label, colored via `--st-*` (bg/line/text) in globals.css:
- `--st-pend` (gold) → pending_request, specialist_approved
- `--st-prog` (blue) → shop_confirmed, in_progress, packaged
- `--st-ready` (terracotta) → ready_for_courier, in_transit
- `--st-done` (green) → delivered
- `--st-bad` (red) → rejected, cancelled

## Flutter parity (Stage E)
Mirror these tokens in a Flutter `ThemeData` (light + dark/Hub): terracotta seed,
the status palette, 14px radius, Newsreader/Hanken Grotesk/IBM Plex Mono.
