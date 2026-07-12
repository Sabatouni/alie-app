# ALIÈ

Vite + React 19 + Tailwind + Supabase. Quiet-luxury clothing brand, founded in Zanzibar.
Release Candidate v1.0.

## Quick start

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

**First time setting this up?** Use `LAUNCH_CHECKLIST.md` instead of this file — it's the
step-by-step manual walkthrough (Supabase project, migrations, storage bucket, first admin
account, Netlify env vars, deploy). This README is the technical reference.

## Environment variables

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |

Never commit `.env` — it's gitignored. Set the same two variables in Netlify's environment
variable settings for production.

## Database

Run in order, via the Supabase SQL editor or `supabase db push`:

1. `supabase/migrations/0001_init.sql` — full schema: profiles, collections, products,
   product_variants (colour × size), product_images, events, journal, collaborations,
   countdowns, homepage_sections, orders, media_library, site_settings, activity_logs.
   RLS on every table via an `is_admin()` helper. Creates the public `media` storage bucket
   with admin-only write policies.
2. `supabase/migrations/0002_countdown_links.sql` — banner image + product/collection/event/
   collaboration linking columns on `countdowns`.
3. `supabase/migrations/0003_product_seo.sql` — `seo_title` / `seo_description` on `products`.
4. `supabase/migrations/0004_alie_namespace_rename.sql` — renames every table to its
   `alie_` prefixed equivalent (e.g. `products` → `alie_products`), renames `is_admin()` to
   `alie_is_admin()`, renames every RLS policy to match, and renames the storage bucket from
   `media` to `alie-media`. Run this **after** 0001–0003. All tables/functions/bucket names
   referenced elsewhere in this README use the pre-0004 names for narrative clarity — after
   running 0004, the live names are `alie_profiles`, `alie_products`, etc., and the bucket is
   `alie-media`.

Nothing runs automatically against your project — you control when these execute.

Make your first admin account:
```sql
insert into alie_profiles (id, role) values ('<your-auth-user-uuid>', 'admin');
```

## Project structure

```
src/
  components/       Nav, Footer, ProductCard, ImageSlot, CountdownBlock, ProtectedRoute
  context/          AuthContext (Supabase session + admin check), ToastContext
  lib/              supabaseClient.js
  pages/            Home, Collections, ProductDetail, Journal (public storefront)
  pages/admin/      Login, DashboardLayout, Overview, Homepage, Products, Events,
                     JournalAdmin, Collaborations, Countdowns, Media, Orders, SiteSettings
supabase/migrations/  Ordered SQL migrations
netlify.toml          Build config + SPA redirect
eslint.config.js       Lint rules (see note below on one disabled rule)
```

Shared design tokens live in `tailwind.config.js` (`ink` #3B3B05, `paper`, `stone`, `sand`,
`mist`, `camel`, `smoke`). Shared UI primitives (`.btn-primary`, `.field-input`, `.card-panel`,
`.table-row`, `.badge-pill`, `.empty-state`, `.skeleton`, etc.) live in `src/index.css` under
`@layer components` — every admin module uses these instead of repeating raw utility classes,
which is what keeps buttons/inputs/tables looking identical across all nine dashboard pages.

## Deploying to Netlify

`netlify.toml` sets the build command and the SPA redirect rule (`/* → /index.html`) that
React Router needs — without it, every route except `/` 404s on refresh in production.

1. Push to GitHub.
2. Netlify → New site from Git → select the repo.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Site settings → Environment variables.
4. Deploy — build command and publish directory are already configured.

## What's implemented

**Public storefront**, fully Supabase-driven, zero hardcoded marketing copy:
- Home — every section (hero, featured collection, arrivals, philosophy) is CMS-driven from
  `homepage_sections`: hidden/shown/reordered/edited entirely from the admin.
- Collections, Product Detail (with live SEO title/meta description), Journal.
- Countdown system: `CountdownBlock` renders nothing at all unless an admin has enabled a
  countdown for that exact location (`homepage_hero`, `homepage_below_arrivals`,
  `collection_page`, `product_page`, `event_page`). Swaps to the completion message
  automatically at zero. No permanent countdown anywhere.
- Every "Order via WhatsApp" click writes a real row to `alie_orders` before opening WhatsApp.
- Mobile navigation is a proper slide-in menu, not just hidden links — this was fixed during
  the v1.0 polish pass after being found broken on small screens.

**Admin dashboard**, full CRUD on every module: Homepage, Products, Events, Journal,
Collaborations, Countdowns, Media Library (real Supabase Storage upload, not a URL-paste
stub), Orders (status tracking + CSV export), Site Settings. Consistent buttons, inputs,
tables, loading skeletons, empty states, and toast notifications for every save/delete across
all nine modules — built from a shared component-class system in `index.css`, not duplicated
per page.

**Performance**: the admin dashboard is code-split from the public bundle (`React.lazy` +
`Suspense` per route) — a storefront visitor never downloads dashboard code. `npm run build`
produces no bundle-size warnings.

**Quality gates**: `npm run lint` passes clean (zero errors/warnings) against a real ESLint
config — not just an unused script pointing at a missing config file. `npm run build` passes
clean. No `console.log`/`console.error` left in source.

## Known limitations (genuine, not hidden)

- **Product colours/sizes/multiple images** (`alie_product_variants`, `alie_product_images`) are created
  directly in Supabase for now, not from the admin Products form — that form covers the core
  product fields (name, price, category, fabric, SEO, status) only. This is the single biggest
  gap between "admin can do everything" and where the app actually is.
- Homepage section reordering is up/down buttons, not drag-and-drop.
- Journal body is a plain textarea, not a rich text editor.
- Image fields across the admin take a pasted Media Library URL rather than an inline picker —
  upload itself is real and working, this is one extra copy/paste step.
- Related products match by collection only, not a styling/recommendation algorithm.
- No automated tests.
- `npm audit` reports one moderate dev-server-only vulnerability in esbuild (via Vite 5).
  It affects the local dev server, not the production build output or the deployed site.
  Fixing it requires a breaking Vite 5→8 major upgrade, which isn't something to force through
  silently in a polish pass — flagging it here as an accepted, understood risk instead.
- One ESLint rule (`react-hooks/set-state-in-effect`) is intentionally disabled — it's tuned
  for React Compiler-era patterns and flags every standard fetch-on-mount effect used
  throughout the admin CRUD pages, which is idiomatic React, not a bug. See `eslint.config.js`
  for the inline reasoning.

## Brand tokens & mark

Colors and type live in `tailwind.config.js`. The sparkle mark is inlined as SVG everywhere it
appears (nav, footer, login screen) rather than as an image file, so it stays crisp at any size.
