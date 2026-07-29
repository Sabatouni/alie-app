# ALIÈ — Full Project Audit Report

**Date:** 13 July 2026
**Scope:** React/Vite frontend, Supabase (shared project `gqtdsvptbizxzuxzdvzd` / "Ulphoria" org), GitHub repo `Sabatouni/alie-app`, Netlify deployment config.

---

## A) Problems found

1. **Storage upload failure (`alie_is_admin()` / schema error).** Reported as a 400 schema/policy error on image upload. Live inspection showed the database had **already been repaired** at some point (function has `search_path = public`, storage policies use inline subqueries) — but no upload was ever retried successfully: `alie_media_library` had 0 rows. The repaired SQL existed only as uncommitted local files, so nothing guaranteed the live DB and the repo matched.
2. **No server-side upload limits.** The `alie-media` bucket had `file_size_limit = none` and `allowed_mime_types = any`. Anything authenticated as admin could push arbitrarily large files of any type.
3. **Weak client-side image pipeline.** The committed code had a hard 8 MB reject with no compression. The uncommitted local version compressed only files > 2 MB, always re-encoded to JPEG (destroying PNG transparency), never produced WebP, handled one file at a time, and gave no feedback on savings.
4. **GitHub out of sync.** The remote had a single commit ("Initial Alie website"). Every fix since — the alie_ namespace work, auth race fix, storage SQL — existed only as uncommitted local changes. A Netlify deploy from GitHub would have shipped the old, broken code.
5. **Nested junk git repo.** `Downloads\alie-app` is itself a git repo (tracking only `.gitattributes` and a stub `package-lock.json`) containing the real repo at `Downloads\alie-app\alie-app`. CI/deploy tooling pointed at the wrong level would fail confusingly.
6. **Repo debris.** Twelve `vite.config.js.timestamp-*.mjs` crash artifacts, five of them committed. Four superseded, intentionally-empty migration stubs still tracked.
7. **Stale documentation.** `LAUNCH_CHECKLIST.md` instructed running four migrations in an order that no longer exists (three of the four files were empty stubs saying "do not run").
8. **AuthContext race condition.** `loading` flipped false as soon as the session resolved, before the profile fetch finished — `ProtectedRoute` could see `isAdmin=false` for a real admin and bounce them to login. (Fixed in the local working tree; now committed.)

## B) Root causes

- **The fix-was-written-but-never-landed pattern.** The storage repair was authored (and evidently run against the live DB once) but never committed, never pushed, and never re-tested end-to-end. The project had no single source of truth: live DB, local files, and GitHub were three different states.
- **Original bug:** `alie_is_admin()` was first created as `SECURITY DEFINER` **without** `SET search_path = public`. Supabase Storage evaluates `storage.objects` RLS in a context where `public` is not on the search path, so the function's unqualified `alie_profiles` reference failed, surfacing as an opaque 400 "schema" error on every upload INSERT.
- **Upload limits** were treated as a frontend concern only; the bucket was created with `(id, name, public)` and nothing else.

## C) Files changed

| File | Change |
|---|---|
| `src/lib/imageOptimizer.js` | **New.** Full client-side optimization pipeline (see below). |
| `src/pages/admin/Media.jsx` | Rewritten upload flow: uses the optimizer, multi-file input, per-file progress, success notice with MB saved, storage-object rollback when the DB insert fails, `cacheControl: 31536000`, unmount-safe state, decode-friendly delete path. |
| `src/context/AuthContext.jsx` | Loading race fixed (committed the pending local fix). |
| `supabase/migrations/0001_alie_init.sql` | Canonical init: correct function config, inline storage policies, bucket created **with** 8 MB limit + image MIME allowlist. |
| `supabase/fixes/fix_storage_policies.sql` | One-shot repair for existing deployments; now also enforces bucket limits. |
| `supabase/fixes/diagnose.sql` | **New.** Read-only live-DB health check (functions, policies, buckets, leftovers, admin count). |
| `supabase/migrations/0001_init.sql`, `0002_countdown_links.sql`, `0003_product_seo.sql`, `0004_alie_namespace_rename.sql` | Deleted (empty superseded stubs). |
| `vite.config.js.timestamp-*.mjs` | Deleted and gitignored. |
| `LAUNCH_CHECKLIST.md` | Migration section rewritten to match reality (3 real migrations + one-time fix script). |
| `.gitignore` | Added `vite.config.js.timestamp-*.mjs`. |

Committed as five clean commits on `main`, ready to push to `Sabatouni/alie-app`.

## D) Supabase SQL changes made (live, via your dashboard session)

- **Verified (read-only):** `public.alie_is_admin` exists with `security definer` + `search_path=public`; all four `alie-media` storage policies present and using the inline `alie_profiles` subquery; 19 `alie_` tables, RLS enabled on all 19; 2 admin profiles; no policies referencing the old unprefixed `is_admin()`.
- **Applied (with your approval):** `UPDATE storage.buckets SET file_size_limit = 8388608, allowed_mime_types = ARRAY[jpeg,png,webp,gif,avif,svg] WHERE id = 'alie-media'` — verified via `RETURNING`.
- **Not touched:** everything belonging to the co-tenant app (its `ulphoria-images` bucket/policies, its `admins` and `products` tables). The `products` table found in `public` is almost certainly the co-tenant's, not an ALIÈ leftover — left strictly alone.

## E) Security improvements

- Bucket now rejects non-image MIME types and files > 8 MB at the Storage layer, independent of any client code.
- Admin write path unchanged and verified: `to authenticated` + admin-role subquery on all INSERT/UPDATE/DELETE storage policies; public gets SELECT only.
- Confirmed `.env` is gitignored and was never committed (only the anon key lives there, which is public by design — but keep it out of the repo anyway).
- Orphan prevention: if the `alie_media_library` insert fails after a storage upload, the uploaded object is now removed instead of lingering publicly.

## F) Future risks discovered

1. **The outer git repo at `Downloads\alie-app`** should be deleted (`Downloads\alie-app\.git`, `.gitattributes`, stub `package-lock.json`) or the inner project moved to its own folder. Left in place for you to decide — deleting a `.git` folder is not something to do silently.
2. **Shared-project blast radius.** ALIÈ shares Postgres, Auth, and Storage quotas with the other production app. A traffic spike or storage abuse in either app affects both. Free-tier limits apply to the sum.
3. **`alie_orders` allows anonymous INSERT** (by design, for WhatsApp orders). That's a spam/flooding vector — no rate limiting exists. Acceptable at launch; add a captcha or edge-function rate limit if abuse appears.
4. **Anon key rotation:** if you ever rotate keys in the shared project, both apps' deployments need env updates simultaneously.
5. **Supabase free tier** pauses inactive projects and caps storage at 1 GB — with two production apps in one project you'll hit this sooner than a single-app project would.
6. **HEIC uploads:** browsers other than Safari can't decode HEIC. The optimizer now shows an actionable message (switch iPhone camera to "Most Compatible") instead of a cryptic failure, but true HEIC support would need a wasm decoder library.

## G) Recommendations for scaling

- **Move ALIÈ to its own Supabase project** before real traffic. The `alie_` prefix discipline works, but quotas, key rotation, pausing, and upgrade decisions are all entangled with the co-tenant. Migration is straightforward now (3 migration files + storage copy) and only gets harder.
- **Turn on Netlify deploy previews + branch deploys** once GitHub is the source of truth (it is now, after you push).
- **Add image variants** when the catalog grows: generate a ~400 px thumbnail at upload time (the optimizer already has the canvas plumbing) and store both URLs, so grid views stop paying full-image cost.
- **Add a `supabase/migrations` discipline:** every DB change lands as a numbered migration file in the same commit as the code that needs it. The drift you just experienced came from ad-hoc SQL-editor changes.
- **Consider Supabase CLI + `supabase db push`** (or at least the MCP connector) so schema changes are reviewable and repeatable instead of pasted.
- Bundle size is fine (463 kB main, 132 kB gzipped; admin code-split). Revisit only if you add heavy libraries.

## H) Verification performed

- `eslint .` — clean, zero warnings.
- `vite build` — succeeds.
- Live DB diagnostic — all checks green (section D).
- End-to-end upload test — see test log below / pending dev-server session.
