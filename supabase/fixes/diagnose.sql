-- ALIÈ — live database diagnostic (READ-ONLY, safe to run any time)
-- Paste the whole file into the Supabase SQL Editor and run it.
-- Each block is labelled; share the full output to get a precise repair plan.

-- 1) Which admin functions exist, in which schema, with what security config?
--    Healthy: one row — public.alie_is_admin, prosecdef=true, proconfig={search_path=public}
select 'FUNCTIONS' as check,
       p.pronamespace::regnamespace::text as schema,
       p.proname,
       p.prosecdef as security_definer,
       p.proconfig as config,
       pg_get_userbyid(p.proowner) as owner
from pg_proc p
where p.proname in ('is_admin', 'alie_is_admin');

-- 2) Storage policies — what exists on storage.objects and what do they reference?
--    Healthy: 4 'alie_media bucket:' policies using the inline alie_profiles subquery.
--    Unhealthy: policies whose qual/with_check call alie_is_admin() or is_admin(),
--    or leftover 'media bucket:' policies from before the rename.
select 'STORAGE POLICIES' as check,
       policyname, cmd, roles::text,
       coalesce(qual, '') as using_expr,
       coalesce(with_check, '') as with_check_expr
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- 3) Bucket configuration.
--    Healthy: alie-media, public=true, file_size_limit=8388608, image mime types.
select 'BUCKETS' as check, id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('alie-media', 'media');

-- 4) ALIÈ tables present (expect 19, all alie_-prefixed, all RLS-enabled).
select 'ALIE TABLES' as check, tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename like 'alie\_%' escape '\'
order by tablename;

-- 5) Any OLD unprefixed ALIÈ tables still present? (expect zero rows;
--    other apps' tables in the shared project will also appear here — ignore
--    anything that is not an ALIÈ table name)
select 'UNPREFIXED LEFTOVERS?' as check, tablename
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','collections','products','product_variants','product_images',
                    'events','event_images','journal_categories','journal_tags','journal_posts',
                    'journal_post_tags','countdowns','collaborations','collaboration_media',
                    'homepage_sections','orders','media_library','site_settings','activity_logs');

-- 6) Do we actually have an admin user?
select 'ADMIN USERS' as check, count(*) as admin_count
from public.alie_profiles
where role = 'admin';

-- 7) Table policies that call the OLD unprefixed is_admin() (expect zero rows).
select 'POLICIES CALLING OLD is_admin()' as check, schemaname, tablename, policyname
from pg_policies
where (qual like '%is_admin%' and qual not like '%alie_is_admin%')
   or (with_check like '%is_admin%' and with_check not like '%alie_is_admin%');
