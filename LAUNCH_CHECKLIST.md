# ALIÈ — Launch Checklist

Manual steps only. Everything the code can do automatically, it already does.

## 1. Supabase project

- [ ] Create a new project at supabase.com (or use the existing shared project).
- [ ] In the SQL Editor, run the three migrations **in order**:
  1. `supabase/migrations/0001_alie_init.sql` — all tables, `alie_is_admin()`, RLS, the
     `alie-media` bucket, and storage policies, everything already in the `alie_` namespace.
  2. `supabase/migrations/0002_alie_countdown_links.sql`
  3. `supabase/migrations/0003_alie_product_seo.sql`
- [ ] **Existing deployments only:** if the project was set up before the storage-policy fix,
      run `supabase/fixes/fix_storage_policies.sql` once — it recreates `alie_is_admin()` with
      `set search_path = public` and rebuilds the four `storage.objects` policies. Without it,
      admin image uploads fail with a schema/policy 400 error.
- [ ] Confirm the `alie-media` storage bucket exists (Storage tab). Public read, admin-only write.
- [ ] Copy your Project URL and anon public key (Settings → API).

## 2. First admin account

- [ ] In your app (or Supabase Auth UI), sign up a user with email/password.
- [ ] In the SQL Editor, promote that user:
  ```sql
  insert into alie_profiles (id, role) values ('<user-uuid-from-auth-users-table>', 'admin');
  ```
  Find the UUID in Authentication → Users.
- [ ] Log in at `/admin/login` with that account and confirm you land on the dashboard, not the "no admin access" screen.

## 3. Environment variables

- [ ] Copy `.env.example` to `.env` locally.
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 1.
- [ ] `npm install && npm run dev` — confirm the homepage loads and shows the empty states (no products yet is expected).

## 4. Brand configuration (in the admin dashboard, not code)

- [ ] Site Settings → set the WhatsApp order number (digits only, country code, no `+`). Orders won't work until this is set — the storefront will show an error toast if a customer tries to order first.
- [ ] Site Settings → confirm brand name / founded-in / social links.
- [ ] Homepage → review the four default sections (hero, featured collection, arrivals, philosophy), edit copy, and paste in real image URLs once uploaded.

## 5. Content

- [ ] Media Library → upload real campaign photography. Copy each URL.
- [ ] Products → create at least a few published products (variants/colors/sizes are a separate step inside Supabase directly for now — see README "known limitations").
- [ ] Paste image URLs from Media Library into Homepage sections, countdown banners, event/journal/collaboration image fields as needed.
- [ ] Countdowns → only if you want one live at launch; otherwise leave none enabled and the site runs cleanly with no countdown anywhere.

## 6. Netlify deployment

- [ ] Push this repo to GitHub (or GitLab/Bitbucket).
- [ ] Netlify → Add new site → Import from Git → select the repo.
- [ ] Build command and publish directory are already set via `netlify.toml` — don't need to touch them.
- [ ] Site settings → Environment variables → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- [ ] Deploy.
- [ ] After deploy, hard-refresh a non-home route (e.g. `/collections`) to confirm the SPA redirect works and it doesn't 404.

## 7. Post-launch smoke test

- [ ] Homepage loads, sections appear in the order set in the admin.
- [ ] A published product's "Order via WhatsApp" opens WhatsApp with a pre-filled message, and a row appears in Admin → Orders.
- [ ] Admin login works from a fresh browser session (not just the one you were testing in).
- [ ] Mobile: open the site on an actual phone (not just resized desktop browser) and confirm the hamburger menu opens/closes and every nav link works.
- [ ] Enable one countdown, confirm it appears only where assigned, then disable it and confirm it disappears with no layout gap.

## Known gaps to plan around

These are documented, working-as-designed simplifications, not bugs:

- Product colours/sizes (`alie_product_variants`) and multiple images (`alie_product_images`) are created directly in Supabase for now, not yet from the admin Products form —