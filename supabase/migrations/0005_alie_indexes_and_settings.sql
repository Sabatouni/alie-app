-- ALIÈ — production hardening
--
-- Additive and idempotent. No table is dropped, no column removed, no row
-- deleted. Safe to run more than once.
--
--   1. Indexes on every foreign key and on the columns the storefront filters by.
--      Postgres does NOT index foreign keys automatically, so each of these was
--      a sequential scan.
--   2. A trigger that maintains alie_products.updated_at, which until now was
--      set once at insert and never touched again.
--   3. The alie_site_settings rows the new Site Settings screen writes to,
--      seeded so the footer renders before an admin has saved anything.

-- ============================================================
-- 1. INDEXES
-- ============================================================

create index if not exists alie_products_collection_id_idx      on alie_products (collection_id);
create index if not exists alie_products_status_idx             on alie_products (status);
create index if not exists alie_products_featured_idx           on alie_products (is_featured) where is_featured;

create index if not exists alie_product_images_product_sort_idx on alie_product_images (product_id, sort_order);
create index if not exists alie_product_variants_product_id_idx on alie_product_variants (product_id);

create index if not exists alie_event_images_event_id_idx       on alie_event_images (event_id, sort_order);
create index if not exists alie_collab_media_collab_id_idx      on alie_collaboration_media (collaboration_id, sort_order);

create index if not exists alie_journal_posts_status_idx        on alie_journal_posts (status, published_at desc);
create index if not exists alie_journal_posts_category_id_idx   on alie_journal_posts (category_id);
create index if not exists alie_journal_post_tags_tag_id_idx    on alie_journal_post_tags (tag_id);

-- The storefront looks countdowns up by exactly this pair.
create index if not exists alie_countdowns_location_idx         on alie_countdowns (location_key, is_enabled);
create index if not exists alie_countdowns_product_id_idx       on alie_countdowns (product_id);
create index if not exists alie_countdowns_collection_id_idx    on alie_countdowns (collection_id);
create index if not exists alie_countdowns_event_id_idx         on alie_countdowns (event_id);
create index if not exists alie_countdowns_collaboration_id_idx on alie_countdowns (collaboration_id);

create index if not exists alie_collaborations_countdown_id_idx on alie_collaborations (launch_countdown_id);

create index if not exists alie_orders_status_created_idx       on alie_orders (status, created_at desc);
create index if not exists alie_media_library_created_idx       on alie_media_library (created_at desc);
create index if not exists alie_media_library_url_idx           on alie_media_library (url);
create index if not exists alie_product_images_url_idx          on alie_product_images (url);
create index if not exists alie_activity_logs_actor_id_idx      on alie_activity_logs (actor_id);

-- ============================================================
-- 2. updated_at TRIGGER
-- ============================================================
-- The column existed with `default now()` but nothing ever wrote to it, so
-- every product reported an updated_at equal to its created_at. The admin sends
-- an explicit updated_at on save; this covers writes made any other way.

create or replace function alie_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists alie_products_touch_updated_at on alie_products;
create trigger alie_products_touch_updated_at
  before update on alie_products
  for each row
  execute function alie_touch_updated_at();

-- ============================================================
-- 3. SITE SETTINGS ROWS
-- ============================================================
-- Admin → Site Settings upserts on `key`, so these are not strictly required.
-- Seeding them means the footer has structure on a fresh deploy.
--
-- Deliberately empty of marketing copy: the storefront renders nothing for a
-- blank value rather than falling back to hardcoded text.

insert into alie_site_settings (key, value) values
  ('footer', jsonb_build_object(
     'blurb', '',
     'copyright', '',
     'columns', jsonb_build_array(
       jsonb_build_object('title', 'Shop', 'links', jsonb_build_array(
         jsonb_build_object('label', 'Collections', 'to', '/collections'),
         jsonb_build_object('label', 'Search',      'to', '/search')
       )),
       jsonb_build_object('title', 'Studio', 'links', jsonb_build_array(
         jsonb_build_object('label', 'Journal',        'to', '/journal'),
         jsonb_build_object('label', 'Events',         'to', '/events'),
         jsonb_build_object('label', 'Collaborations', 'to', '/collaborations')
       ))
     )
   )),
  ('seo', '{"title":"","description":""}'::jsonb)
on conflict (key) do nothing;

-- Extend the existing brand row with the fields the new settings screen edits,
-- without disturbing values that are already there.
update alie_site_settings
set value = jsonb_build_object('email', '', 'logo_url', '', 'tagline', '') || value
where key = 'brand';

-- A homepage row for the Featured Products grid. The storefront hides the
-- section automatically when no product carries is_featured, so shipping it
-- enabled is safe.
insert into alie_homepage_sections (section_key, title, subtitle, sort_order, is_enabled, content)
values ('featured_products', '', '', 5, true, '{}'::jsonb)
on conflict (section_key) do nothing;

-- ============================================================
-- 3b. NORMALISE HOMEPAGE ORDER  (read this before you run it)
-- ============================================================
-- The storefront used to render homepage sections in a hardcoded sequence and
-- ignore sort_order completely, so the reorder arrows in the admin wrote values
-- that never had any effect. On this database that left hero at sort_order 2,
-- behind featured_collection and arrivals.
--
-- Now that the storefront honours sort_order, deploying without this block
-- would silently move the hero to third position on the live homepage. These
-- values reproduce the layout the site renders today.
--
-- If you have DELIBERATELY arranged the sections since reordering started
-- working, delete this block before running the migration.

update alie_homepage_sections set sort_order = 0 where section_key = 'hero';
update alie_homepage_sections set sort_order = 1 where section_key = 'featured_collection';
update alie_homepage_sections set sort_order = 2 where section_key = 'arrivals';
update alie_homepage_sections set sort_order = 3 where section_key = 'featured_products';
update alie_homepage_sections set sort_order = 4 where section_key = 'philosophy';

-- ============================================================
-- 4. KNOWN SECURITY ADVISORIES — read, don't blindly "fix"
-- ============================================================
-- Supabase's linter flags four things on this project. Three are deliberate:
--
--   * `alie_orders: anon insert WITH CHECK (true)` — required. Customers order
--     without an account, so the storefront must be able to insert an order
--     anonymously. The policy grants INSERT only; anon cannot read, update or
--     delete orders. The residual risk is spam, which needs rate limiting at
--     the edge (Netlify / Supabase), not an RLS change.
--
--   * `alie_is_admin()` executable by anon and authenticated — do NOT revoke.
--     RLS policy expressions are evaluated with the caller's privileges, so
--     revoking EXECUTE would break every admin-write policy in schema 0001.
--     The function leaks nothing: it returns whether the CALLER is an admin.
--
--   * `alie-media` public bucket allows listing — the bucket must be public for
--     image URLs to resolve. The SELECT policy also lets a client enumerate
--     object names. Everything in it is public product photography. Tighten it
--     only if you start storing anything that isn't meant to be seen.
--
-- One is worth acting on, in the dashboard rather than in SQL:
--
--   * Leaked password protection is disabled.
--     Authentication → Policies → enable "Check against HaveIBeenPwned".
--
-- `rls_auto_enable()` is also flagged; it is not part of ALIÈ's schema and is
-- not referenced by any migration in this repository.

-- ============================================================
-- 5. VERIFY
-- ============================================================
-- select tablename, indexname from pg_indexes
-- where schemaname = 'public' and tablename like 'alie[_]%'
-- order by tablename, indexname;
--
-- select key from alie_site_settings order by key;   -- brand, footer, seo, social
