-- ALIÈ — storage policy fix
-- Run this once in the Supabase SQL Editor on your live project.
--
-- Root cause: alie_is_admin() was created without SET search_path = public.
-- When Supabase Storage evaluates RLS policies its backend context may not
-- have 'public' in the search_path, so the unqualified 'alie_profiles'
-- reference inside the function throws an internal error that Storage
-- surfaces as a 400 Bad Request with an empty response body.
--
-- This script:
--   1. Recreates alie_is_admin() with the correct search_path.
--   2. Drops the old storage policies and recreates them with an inline
--      subquery (bypasses the function entirely for storage — simpler and
--      more resilient).

-- ── 1. Fix the function ─────────────────────────────────────────────────────

create or replace function alie_is_admin()
returns boolean
language sql
security definer
set search_path = public          -- ← the missing line
stable
as $$
  select exists (
    select 1 from public.alie_profiles
    where public.alie_profiles.id = auth.uid()
      and public.alie_profiles.role = 'admin'
  );
$$;

-- ── 1b. Ensure the bucket exists with server-side limits ───────────────────
-- 8 MB cap + images only, enforced by Storage itself (defense in depth
-- against anything that bypasses the admin UI's client-side optimizer).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'alie-media', 'alie-media', true,
    8388608, -- 8 MB
    array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml']
  )
  on conflict (id) do update
    set public             = true,
        file_size_limit    = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Replace storage policies ─────────────────────────────────────────────

drop policy if exists "alie_media bucket: public read"   on storage.objects;
drop policy if exists "alie_media bucket: admin write"   on storage.objects;
drop policy if exists "alie_media bucket: admin update"  on storage.objects;
drop policy if exists "alie_media bucket: admin delete"  on storage.objects;

-- Also drop old-name policies in case the rename migration ran earlier
drop policy if exists "media bucket: public read"        on storage.objects;
drop policy if exists "media bucket: admin write"        on storage.objects;
drop policy if exists "media bucket: admin update"       on storage.objects;
drop policy if exists "media bucket: admin delete"       on storage.objects;

create policy "alie_media bucket: public read"
  on storage.objects for select
  using (bucket_id = 'alie-media');

create policy "alie_media bucket: admin write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'alie-media'
    and (select role from public.alie_profiles where id = auth.uid()) = 'admin'
  );

create policy "alie_media bucket: admin update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'alie-media'
    and (select role from public.alie_profiles where id = auth.uid()) = 'admin'
  );

create policy "alie_media bucket: admin delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'alie-media'
    and (select role from public.alie_profiles where id = auth.uid()) = 'admin'
  );

-- ── 3. Verify ───────────────────────────────────────────────────────────────
-- After running the above, execute the two lines below to confirm the policies
-- are in place (you should see 4 rows: public read + 3 admin rows).
--
-- select policyname, cmd, roles
-- from pg_policies
-- where tablename = 'objects' and schemaname = 'storage'
--   and policyname like 'alie_media%';
