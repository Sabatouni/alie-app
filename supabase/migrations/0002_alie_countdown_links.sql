-- ALIÈ — countdown linking + homepage section image support
-- Run after 0001_alie_init.sql

alter table alie_countdowns add column if not exists banner_image_url text;
alter table alie_countdowns add column if not exists product_id uuid references alie_products(id) on delete cascade;
alter table alie_countdowns add column if not exists collection_id uuid references alie_collections(id) on delete cascade;
alter table alie_countdowns add column if not exists event_id uuid references alie_events(id) on delete cascade;
alter table alie_countdowns add column if not exists collaboration_id uuid references alie_collaborations(id) on delete cascade;

-- location_key values used by the storefront to know where to render a countdown:
-- 'homepage_hero', 'homepage_below_arrivals', 'collection_page', 'product_page', 'event_page'
comment on column alie_countdowns.location_key is
  'Where the storefront renders this countdown: homepage_hero, homepage_below_arrivals, collection_page, product_page, event_page.';
