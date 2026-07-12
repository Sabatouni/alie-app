-- ALIÈ — initial schema
-- Fresh-project safe: objects are created in strict dependency order.
--
-- Order:
--   1. Tables (dependency order: no forward references)
--   2. alie_is_admin() function (requires alie_profiles to exist)
--   3. Enable Row Level Security
--   4. RLS policies
--   5. Storage bucket
--   6. Storage policies
--   7. Seed data

-- ============================================================
-- 1. TABLES
-- ============================================================

-- alie_profiles (depends on: auth.users only)
create table alie_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now()
);

-- alie_collections (no app-table dependencies)
create table alie_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  banner_image_url text,
  campaign_image_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- alie_products (depends on: alie_collections)
create table alie_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  story text,
  category text not null,
  collection_id uuid references alie_collections(id) on delete set null,
  fabric text,
  care_instructions text,
  price numeric(10,2) not null,
  compare_at_price numeric(10,2),
  is_limited boolean not null default false,
  is_featured boolean not null default false,
  is_new boolean not null default false,
  stock_count int not null default 0,
  sku text unique,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- alie_product_variants (depends on: alie_products)
create table alie_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references alie_products(id) on delete cascade,
  color_name text not null,
  color_hex text,
  size text not null,
  stock int not null default 0,
  sku text unique,
  created_at timestamptz not null default now()
);

-- alie_product_images (depends on: alie_products)
create table alie_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references alie_products(id) on delete cascade,
  url text not null,
  alt_text text,
  sort_order int not null default 0,
  is_primary boolean not null default false
);

-- alie_events (no app-table dependencies)
create table alie_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  banner_image_url text,
  venue text,
  event_date timestamptz,
  status text not null default 'upcoming' check (status in ('upcoming','past','cancelled')),
  registration_url text,
  created_at timestamptz not null default now()
);

-- alie_event_images (depends on: alie_events)
create table alie_event_images (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references alie_events(id) on delete cascade,
  url text not null,
  sort_order int not null default 0
);

-- alie_journal_categories (no app-table dependencies)
create table alie_journal_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

-- alie_journal_tags (no app-table dependencies)
create table alie_journal_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

-- alie_journal_posts (depends on: alie_journal_categories)
create table alie_journal_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  body text,
  hero_image_url text,
  category_id uuid references alie_journal_categories(id) on delete set null,
  author text,
  reading_time int,
  status text not null default 'draft' check (status in ('draft','scheduled','published')),
  featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- alie_journal_post_tags (depends on: alie_journal_posts, alie_journal_tags)
create table alie_journal_post_tags (
  post_id uuid not null references alie_journal_posts(id) on delete cascade,
  tag_id uuid not null references alie_journal_tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

-- alie_countdowns (no app-table dependencies in this migration;
--   product_id / collection_id / event_id / collaboration_id added in 0002)
create table alie_countdowns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  target_at timestamptz not null,
  timezone text not null default 'Africa/Dar_es_Salaam',
  location_key text,
  display_style text default 'default',
  completion_message text default 'Now Available',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- alie_collaborations (depends on: alie_countdowns)
create table alie_collaborations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  partner_name text not null,
  story text,
  hero_image_url text,
  logo_url text,
  status text not null default 'upcoming' check (status in ('upcoming','active','past')),
  launch_countdown_id uuid references alie_countdowns(id) on delete set null,
  created_at timestamptz not null default now()
);

-- alie_collaboration_media (depends on: alie_collaborations)
create table alie_collaboration_media (
  id uuid primary key default gen_random_uuid(),
  collaboration_id uuid not null references alie_collaborations(id) on delete cascade,
  url text not null,
  type text not null default 'image' check (type in ('image','video')),
  sort_order int not null default 0
);

-- alie_homepage_sections (no app-table dependencies)
create table alie_homepage_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  title text,
  subtitle text,
  content jsonb default '{}'::jsonb,
  image_url text,
  sort_order int not null default 0,
  is_enabled boolean not null default true
);

-- alie_orders (no app-table dependencies)
create table alie_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('ALIE-' || to_char(now(), 'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  customer_name text,
  customer_phone text,
  customer_email text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2),
  status text not null default 'pending' check (status in ('pending','contacted','completed','cancelled')),
  notes text,
  whatsapp_message text,
  created_at timestamptz not null default now()
);

-- alie_media_library (depends on: alie_profiles)
create table alie_media_library (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  url text not null,
  folder text default 'general',
  alt_text text,
  uploaded_by uuid references alie_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- alie_site_settings (no app-table dependencies)
create table alie_site_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb
);

-- alie_activity_logs (depends on: alie_profiles)
create table alie_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references alie_profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. FUNCTION (requires alie_profiles to exist)
-- ============================================================

create or replace function alie_is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from alie_profiles
    where alie_profiles.id = auth.uid() and alie_profiles.role = 'admin'
  );
$$;

-- ============================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table alie_profiles enable row level security;
alter table alie_collections enable row level security;
alter table alie_products enable row level security;
alter table alie_product_variants enable row level security;
alter table alie_product_images enable row level security;
alter table alie_events enable row level security;
alter table alie_event_images enable row level security;
alter table alie_journal_categories enable row level security;
alter table alie_journal_tags enable row level security;
alter table alie_journal_posts enable row level security;
alter table alie_journal_post_tags enable row level security;
alter table alie_countdowns enable row level security;
alter table alie_collaborations enable row level security;
alter table alie_collaboration_media enable row level security;
alter table alie_homepage_sections enable row level security;
alter table alie_orders enable row level security;
alter table alie_media_library enable row level security;
alter table alie_site_settings enable row level security;
alter table alie_activity_logs enable row level security;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- alie_profiles
create policy "alie_profiles: self read"    on alie_profiles for select using (auth.uid() = id or alie_is_admin());
create policy "alie_profiles: self update"  on alie_profiles for update using (auth.uid() = id or alie_is_admin());
create policy "alie_profiles: admin insert" on alie_profiles for insert with check (auth.uid() = id or alie_is_admin());

-- alie_collections
create policy "alie_collections: public read active" on alie_collections for select using (is_active or alie_is_admin());
create policy "alie_collections: admin write"        on alie_collections for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_products
create policy "alie_products: public read published" on alie_products for select using (status = 'published' or alie_is_admin());
create policy "alie_products: admin write"           on alie_products for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_product_variants
create policy "alie_product_variants: public read" on alie_product_variants for select using (
  exists (select 1 from alie_products p where p.id = product_id and (p.status = 'published' or alie_is_admin()))
);
create policy "alie_product_variants: admin write" on alie_product_variants for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_product_images
create policy "alie_product_images: public read" on alie_product_images for select using (
  exists (select 1 from alie_products p where p.id = product_id and (p.status = 'published' or alie_is_admin()))
);
create policy "alie_product_images: admin write" on alie_product_images for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_events
create policy "alie_events: public read" on alie_events for select using (true);
create policy "alie_events: admin write" on alie_events for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_event_images
create policy "alie_event_images: public read" on alie_event_images for select using (true);
create policy "alie_event_images: admin write" on alie_event_images for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_journal_categories
create policy "alie_journal_categories: public read" on alie_journal_categories for select using (true);
create policy "alie_journal_categories: admin write" on alie_journal_categories for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_journal_tags
create policy "alie_journal_tags: public read" on alie_journal_tags for select using (true);
create policy "alie_journal_tags: admin write" on alie_journal_tags for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_journal_posts
create policy "alie_journal_posts: public read published" on alie_journal_posts for select using (status = 'published' or alie_is_admin());
create policy "alie_journal_posts: admin write"           on alie_journal_posts for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_journal_post_tags
create policy "alie_journal_post_tags: public read" on alie_journal_post_tags for select using (true);
create policy "alie_journal_post_tags: admin write" on alie_journal_post_tags for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_countdowns
create policy "alie_countdowns: public read enabled" on alie_countdowns for select using (is_enabled or alie_is_admin());
create policy "alie_countdowns: admin write"         on alie_countdowns for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_collaborations
create policy "alie_collaborations: public read" on alie_collaborations for select using (true);
create policy "alie_collaborations: admin write" on alie_collaborations for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_collaboration_media
create policy "alie_collaboration_media: public read" on alie_collaboration_media for select using (true);
create policy "alie_collaboration_media: admin write" on alie_collaboration_media for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_homepage_sections
create policy "alie_homepage_sections: public read enabled" on alie_homepage_sections for select using (is_enabled or alie_is_admin());
create policy "alie_homepage_sections: admin write"         on alie_homepage_sections for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_orders
create policy "alie_orders: anon insert"  on alie_orders for insert with check (true);
create policy "alie_orders: admin read"   on alie_orders for select using (alie_is_admin());
create policy "alie_orders: admin write"  on alie_orders for update using (alie_is_admin()) with check (alie_is_admin());
create policy "alie_orders: admin delete" on alie_orders for delete using (alie_is_admin());

-- alie_media_library
create policy "alie_media_library: public read" on alie_media_library for select using (true);
create policy "alie_media_library: admin write" on alie_media_library for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_site_settings
create policy "alie_site_settings: public read" on alie_site_settings for select using (true);
create policy "alie_site_settings: admin write" on alie_site_settings for all using (alie_is_admin()) with check (alie_is_admin());

-- alie_activity_logs
create policy "alie_activity_logs: admin read"   on alie_activity_logs for select using (alie_is_admin());
create policy "alie_activity_logs: admin insert" on alie_activity_logs for insert with check (alie_is_admin());


-- ============================================================
-- 5. STORAGE BUCKET
-- ============================================================

insert into storage.buckets (id, name, public)
  values ('alie-media', 'alie-media', true)
  on conflict (id) do nothing;

-- ============================================================
-- 6. STORAGE POLICIES
-- ============================================================

create policy "alie_media bucket: public read"   on storage.objects for select using (bucket_id = 'alie-media');
create policy "alie_media bucket: admin write"   on storage.objects for insert with check (bucket_id = 'alie-media' and alie_is_admin());
create policy "alie_media bucket: admin update"  on storage.objects for update using  (bucket_id = 'alie-media' and alie_is_admin());
create policy "alie_media bucket: admin delete"  on storage.objects for delete using  (bucket_id = 'alie-media' and alie_is_admin());

-- ============================================================
-- 7. SEED DATA
-- ============================================================

insert into alie_homepage_sections (section_key, title, subtitle, sort_order, content) values
  ('hero',                'ALIE',                                                           'The Essential Collection',                    0, '{"body":"Linen and cotton, cut for movement and refined ease. Made to be worn, not styled.","cta_label":"Explore the Collection"}'::jsonb),
  ('featured_collection', 'The Essential Collection',                                       'Eleven pieces built for years, not seasons.', 1, '{}'::jsonb),
  ('arrivals',            'This week''s pieces',                                            'Everyday Linen',                              2, '{}'::jsonb),
  ('philosophy',          'We make fewer things, cut to move with you and built to last.',  'Brand Philosophy',                            3, '{}'::jsonb)
on conflict (section_key) do nothing;

insert into alie_site_settings (key, value) values
  ('brand',  '{"name":"ALIE","founded_in":"Zanzibar","whatsapp_number":""}'::jsonb),
  ('social', '{"instagram":"","whatsapp":"","pinterest":""}'::jsonb)
on conflict (key) do nothing;
