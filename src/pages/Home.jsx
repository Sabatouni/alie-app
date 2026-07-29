import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../context/SettingsContext';
import ProductCard from '../components/ProductCard';
import ImageSlot from '../components/ImageSlot';
import CountdownBlock from '../components/CountdownBlock';
import { setMeta } from '../lib/seo';

// Nothing on this page carries fallback marketing copy any more. A section with
// no title simply doesn't render its heading, and a section an admin has hidden
// doesn't render at all. The old code had strings like "Everyday Linen" and
// "Linen and cotton, cut for movement and refined ease." baked into the JSX,
// which meant hiding or renaming them in the admin had no effect.

const SELECT = '*, product_images:alie_product_images(*), product_variants:alie_product_variants(*), collections:alie_collections(name,slug)';

export default function Home() {
  const { brand, seo } = useSettings();
  const [arrivals, setArrivals] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: prods }, { data: feat }, { data: secs }] = await Promise.all([
        supabase.from('alie_products').select(SELECT).eq('status', 'published').order('created_at', { ascending: false }).limit(4),
        supabase.from('alie_products').select(SELECT).eq('status', 'published').eq('is_featured', true).order('created_at', { ascending: false }).limit(4),
        supabase.from('alie_homepage_sections').select('*').eq('is_enabled', true).order('sort_order'),
      ]);
      setArrivals(prods || []);
      setFeatured(feat || []);
      setSections(secs || []);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    setMeta({
      title: seo.title || brand.name || 'ALIÈ',
      description: seo.description || brand.tagline || '',
      image: sections.find((s) => s.section_key === 'hero')?.image_url,
    });
  }, [seo.title, seo.description, brand.name, brand.tagline, sections]);

  // Sections render in the admin's sort order rather than a fixed sequence, so
  // the reorder arrows in Admin → Homepage actually move things on the site.
  const renderers = {
    hero: (s) => <Hero key={s.id} data={s} />,
    featured_collection: (s) => <FeaturedCollection key={s.id} data={s} />,
    arrivals: (s) => <ProductRow key={s.id} data={s} id="arrivals" products={arrivals} loading={loading} whatsapp={brand.whatsapp_number} />,
    featured_products: (s) => (featured.length ? <ProductRow key={s.id} data={s} products={featured} loading={loading} whatsapp={brand.whatsapp_number} /> : null),
    philosophy: (s) => <Philosophy key={s.id} data={s} />,
  };

  // Countdowns are anchored to the section they follow, so reordering sections
  // in the admin moves their countdown with them. Each renders nothing at all —
  // no wrapper, no spacing — when no enabled countdown targets that slot.
  const COUNTDOWN_AFTER = { hero: 'homepage_hero', arrivals: 'homepage_below_arrivals' };

  return (
    <div>
      {sections.map((s) => {
        const render = renderers[s.section_key];
        if (!render) return null;
        const countdownKey = COUNTDOWN_AFTER[s.section_key];
        return (
          <Fragment key={s.id}>
            {render(s)}
            {countdownKey && <CountdownBlock locationKey={countdownKey} />}
          </Fragment>
        );
      })}
    </div>
  );
}

function Hero({ data }) {
  return (
    <section className="relative h-screen min-h-[700px] flex flex-col justify-end overflow-hidden">
      <div className="absolute inset-0">
        <ImageSlot src={data.image_url} alt={data.title || ''} tone="sand" sizes="100vw" priority />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-ink/15 to-ink/75" />
      <div className="relative z-10 px-6 md:px-14 pb-24 text-paper">
        {data.subtitle && <div className="eyebrow text-camel-soft mb-5">{data.subtitle}</div>}
        {data.title && <h1 className="font-display text-6xl md:text-[9rem] leading-none tracking-wide">{data.title}</h1>}
        {data.content?.body && (
          <p className="text-sm max-w-md mt-5 text-paper/80 leading-relaxed">{data.content.body}</p>
        )}
        {data.content?.cta_label && (
          <a
            href={data.content.cta_href || '#arrivals'}
            className="inline-flex mt-8 text-[11px] tracking-[0.18em] uppercase border border-paper/50 px-7 py-4 hover:bg-paper hover:text-ink transition-colors"
          >
            {data.content.cta_label}
          </a>
        )}
      </div>
    </section>
  );
}

function FeaturedCollection({ data }) {
  return (
    <section className="py-32 md:py-40 px-6 md:px-14 grid md:grid-cols-2 gap-0 items-stretch">
      <div className="aspect-[4/5]">
        <ImageSlot src={data.image_url} alt={data.title || ''} tone="stone" sizes="(max-width: 768px) 100vw, 50vw" />
      </div>
      <div className="flex flex-col justify-center md:pl-16 pt-10 md:pt-0">
        {data.subtitle && <div className="eyebrow text-camel mb-4">{data.subtitle}</div>}
        {data.title && <h2 className="font-display text-4xl md:text-5xl leading-tight">{data.title}</h2>}
        {data.content?.body && <p className="text-[15px] text-ink/70 mt-6 max-w-sm leading-relaxed">{data.content.body}</p>}
        {data.content?.cta_label && (
          <Link
            to={data.content.cta_href || '/collections'}
            className="inline-flex self-start mt-8 text-[11px] tracking-[0.16em] uppercase border-b border-ink pb-1"
          >
            {data.content.cta_label}
          </Link>
        )}
      </div>
    </section>
  );
}

function ProductRow({ data, id, products, loading, whatsapp }) {
  return (
    <section id={id} className="px-6 md:px-14 pb-32">
      <div className="flex justify-between items-end mb-14 flex-wrap gap-6">
        <div>
          {data?.subtitle && <div className="eyebrow text-camel mb-3">{data.subtitle}</div>}
          {data?.title && <h2 className="font-display text-4xl">{data.title}</h2>}
        </div>
        <Link to="/collections" className="text-[11px] tracking-[0.16em] uppercase border-b border-ink pb-1">View all</Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-9">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] skeleton" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="text-ink/50 text-sm">No published products yet — add some in the admin dashboard.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-9">
          {products.map((p) => <ProductCard key={p.id} product={p} whatsappNumber={whatsapp} />)}
        </div>
      )}
    </section>
  );
}

function Philosophy({ data }) {
  return (
    <section className="text-center max-w-3xl mx-auto px-6 py-32">
      {data.subtitle && <div className="eyebrow text-camel mb-6">{data.subtitle}</div>}
      {data.title && <h2 className="font-display text-3xl md:text-5xl leading-snug">{data.title}</h2>}
      {data.content?.body && <p className="text-[15px] text-ink/70 mt-6 leading-relaxed">{data.content.body}</p>}
    </section>
  );
}
