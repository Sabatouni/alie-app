import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../context/SettingsContext';
import ProductCard from '../components/ProductCard';
import ImageSlot from '../components/ImageSlot';
import HeroSlideshow from '../components/HeroSlideshow';
import CountdownBlock from '../components/CountdownBlock';
import Reveal from '../components/Reveal';
import { setMeta } from '../lib/seo';

// The landing page renders the ORIGINAL ALIÈ composition (restored 1:1 from
// the OG build): bottom-anchored cinematic hero, two-column featured spread,
// arrivals grid, centered philosophy statement. The data layer is the current
// one — alie_-prefixed tables, admin sort order, anchored countdowns — so the
// admin dashboard still controls everything. The OG fallback copy is back so
// the page always reads composed while CMS fields are empty; anything the
// admin types replaces it.

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

  // Before the homepage sections arrive there must never be a flash of paper —
  // the first paint is a full-viewport ink field, exactly where the hero will
  // fade in. This is why the campaign photography feels like it starts at the
  // very top: it does, from the first frame.
  if (loading && sections.length === 0) {
    return <div className="h-screen min-h-[700px] bg-ink" aria-hidden="true" />;
  }

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

// ── OG hero: cinematic, bottom-anchored, photography (or the deep duotone
//    field) filling the viewport with a soft ink gradient. The imagery is the
//    original rotating campaign system: newest Media Library uploads crossfade
//    behind the masthead automatically. ──────────────────────────────────────
function Hero({ data }) {
  return (
    <section className="relative h-screen min-h-[700px] flex flex-col justify-end overflow-hidden bg-ink">
      <div className="absolute inset-0">
        <HeroSlideshow primaryUrl={data.image_url} alt={data.title || ''} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-ink/15 to-ink/75" />
      <div className="relative z-10 px-6 md:px-14 pb-24 text-paper">
        {data.subtitle && (
          <Reveal variant="fade" delay={150}>
            <div className="eyebrow text-camel-soft mb-5">{data.subtitle}</div>
          </Reveal>
        )}
        {data.title && (
          <Reveal variant="rise" delay={250}>
            <h1 className="font-display text-6xl md:text-[9rem] leading-none tracking-wide">{data.title}</h1>
          </Reveal>
        )}
        <Reveal variant="fade" delay={420}>
          <p className="text-sm max-w-md mt-5 text-paper/80 leading-relaxed">
            {data.content?.body || 'Linen and cotton, cut for movement and refined ease.'}
          </p>
        </Reveal>
        <Reveal variant="fade" delay={540}>
          <a
            href={data.content?.cta_href || '#arrivals'}
            className="inline-flex mt-8 text-[11px] tracking-[0.18em] uppercase border border-paper/50 px-7 py-4 hover:bg-paper hover:text-ink transition-colors duration-500"
          >
            {data.content?.cta_label || 'Explore the Collection'}
          </a>
        </Reveal>
      </div>
    </section>
  );
}

// ── Featured spread: the OG image-left/text-right bones, with the editorial
//    layering restored — the photograph bleeds toward the viewport edge and a
//    flat smoke panel sits offset behind it, so the section reads as a
//    magazine spread rather than two stacked columns. The panel and bleed
//    only apply from md up; mobile stays a clean single column. ─────────────
function FeaturedCollection({ data }) {
  return (
    <section className="py-32 md:py-40 px-6 md:px-14 grid md:grid-cols-2 gap-0 items-start overflow-x-clip">
      <div className="relative md:-ml-14">
        <div className="hidden md:block absolute top-10 -right-10 -bottom-8 left-12 bg-smoke" aria-hidden="true" />
        <Reveal variant="mask" className="group relative aspect-[4/5] overflow-hidden">
          <div className="w-full h-full img-hover">
            <ImageSlot src={data.image_url} alt={data.title || ''} tone="stone" sizes="(max-width: 768px) 100vw, 50vw" />
          </div>
        </Reveal>
      </div>
      <div className="flex flex-col justify-center md:pl-16 pt-12 md:pt-10">
        <Reveal variant="fade">
          <div className="eyebrow text-camel mb-4">{data.subtitle || 'Featured Collection'}</div>
        </Reveal>
        {data.title && (
          <Reveal variant="rise" delay={120}>
            <h2 className="font-display text-4xl md:text-5xl leading-tight">{data.title}</h2>
          </Reveal>
        )}
        {data.content?.body && (
          <Reveal variant="fade" delay={240}>
            <p className="text-[15px] text-ink/70 mt-6 max-w-sm leading-relaxed">{data.content.body}</p>
          </Reveal>
        )}
        {data.content?.cta_label && (
          <Reveal variant="fade" delay={340}>
            <Link
              to={data.content.cta_href || '/collections'}
              className="link-underline inline-flex self-start mt-8 text-[11px] tracking-[0.16em] uppercase pb-1"
            >
              {data.content.cta_label}
            </Link>
          </Reveal>
        )}
      </div>
    </section>
  );
}

// ── OG arrivals grid: eyebrow + heading left, "View all" right, 4-up grid. ─
function ProductRow({ data, id, products, loading, whatsapp }) {
  return (
    <section id={id} className="px-6 md:px-14 pb-32">
      <Reveal variant="rise" className="flex justify-between items-end mb-14 flex-wrap gap-6">
        <div>
          <div className="eyebrow text-camel mb-3">{data?.subtitle || 'Everyday Linen'}</div>
          <h2 className="font-display text-4xl">{data?.title || "This week's pieces"}</h2>
        </div>
        <Link to="/collections" className="link-underline text-[11px] tracking-[0.16em] uppercase pb-1">View all</Link>
      </Reveal>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-9">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] skeleton" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="text-ink/50 text-sm">No published products yet — add some in the admin dashboard.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-9">
          {products.map((p, i) => (
            <Reveal key={p.id} variant="rise" delay={(i % 4) * 90}>
              <ProductCard product={p} whatsappNumber={whatsapp} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Philosophy: the quiet centered statement, set on a full-width ink band so
//    the page alternates dark → light → dark and closes into the olive footer
//    without a wall of paper. ────────────────────────────────────────────────
function Philosophy({ data }) {
  return (
    <section className="bg-ink text-paper">
      <div className="text-center max-w-3xl mx-auto px-6 py-32 md:py-40">
        <Reveal variant="fade">
          <div className="eyebrow text-camel-soft mb-6">{data.subtitle || 'Brand Philosophy'}</div>
        </Reveal>
        {data.title && (
          <Reveal variant="rise" delay={140}>
            <h2 className="font-display text-3xl md:text-5xl leading-snug">{data.title}</h2>
          </Reveal>
        )}
        {data.content?.body && (
          <Reveal variant="fade" delay={280}>
            <p className="text-[15px] text-paper/70 mt-6 leading-loose max-w-xl mx-auto">{data.content.body}</p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
