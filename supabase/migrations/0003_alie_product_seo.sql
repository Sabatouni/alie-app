-- ALIÈ — SEO fields for products
alter table alie_products add column if not exists seo_title text;
alter table alie_products add column if not exists seo_description text;
