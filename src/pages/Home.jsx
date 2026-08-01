import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../context/SettingsContext';
import ProductCard from '../components/ProductCard';
import ImageSlot from '../components/ImageSlot';
import CountdownBlock from '../components/CountdownBlock';
import FloatingImages from '../components/FloatingImages';
import Reveal from '../components/Reveal';
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

// Restored to the original poster composition: the masthead sits center-left
// in a deep field — wide-tracked eyebrow, enormous serif title, two quiet
// lines, one outlined CTA — the way a Vogue cover opens, not the way an
// ecommerce hero anchors to the bottom. The scrim is asymmetric (deep on the
// text side, nearly clear on the right) so campaign photography stays visible
// where the floating Media Library frames live. All content is still the
// admin's hero section row; only composition changed.
function Hero({ data }) {
  return (
    <section className="relative h-screen min-h-[700px] flex flex-col justify-center overflow-hidden bg-ink">
      <div className="absolute inset-0">
        <ImageSlot src={data.image_url} alt={data.title || ''} tone="sand" sizes="100vw" priority />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/45 to-ink/10" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink/40 to-transparent" />

      <FloatingImages excludeUrl={data.image_url} />

      <div className="relative z-10 px-6 md:px-14 max-w-4xl text-paper">
        {data.subtitle && (
          <Reveal variant="fade" delay={100}>
            <div className="eyebrow tracking-widest3 text-camel-soft mb-6">{data.subtitle}</div>
          </Reveal>
        )}
        {data.title && (
          <Reveal variant="rise" delay={220}>
            <h1 className="font-display text-7xl md:text-[10rem] leading-[0.95] tracking-wide">{data.title}</h1>
          </Reveal>
        )}
        {data.content?.body && (
          <Reveal variant="fade" delay={400}>
            <p className="text-sm max-w-md mt-7 text-paper/80 leading-relaxed">{data.content.body}</p>
          </Reveal>
        )}
        {data.content?.cta_label && (
          <Reveal variant="fade" delay={520}>
            <a
              href={data.content.cta_href || '#arrivals'}
              className="inline-flex mt-10 text-[11px] tracking-[0.18em] uppercase border border-paper/50 px-8 py-4 hover:bg-paper hover:text-ink transition-colors duration-500"
            >
              {data.content.cta_label}
            </a>
          </Reveal>
        )}
      </div>
    </section>
  );
}

// Restored to the original layered spread: the photograph bleeds toward the
// viewport edge with a solid olive panel offset behind it — the overlapping-
// rectangles signature from the first landing page — while the text sits
// lower on the right with generous negative space between the two.
function FeaturedCollection({ data }) {
  return (
    <section className="py-28 md:py-40 px-6 md:px-14 grid md:grid-cols-12 gap-0 items-start overflow-x-clip">
      <div className="relative -ml-6 md:-ml-14 md:col-span-6 lg:col-span-5">
        {/* The offset panel: a flat deep-olive rectangle shifted down-right,
            layered beneath the image like the original composition. */}
        <div className="absolute top-8 -right-6 md:-right-10 bottom-[-2rem] left-10 bg-smoke" aria-hidden="true" />
        <Reveal variant="mask" className="group relative aspect-[4/5] overflow-hidden">
          <div className="w-full h-full img-hover">
            <ImageSlot src={data.image_url} alt={data.title || ''} tone="stone" sizes="(max-width: 768px) 100vw, 50vw" />
          </div>
        </Reveal>
      </div>
      <div className="md:col-span-6 lg:col-span-6 lg:col-start-7 flex flex-col justify-center pt-16 md:pt-24 md:pl-16">
        {data.subtitle && (
          <Reveal variant="fade">
            <div className="eyebrow text-camel mb-4">{data.subtitle}</div>
          </Reveal>
        )}
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

function ProductRow({ data, id, products, loading, whatsapp }) {
  return (
    <section id={id} className="px-6 md:px-14 pt-24 md:pt-28 pb-32">
      <Reveal variant="rise" className="flex justify-between items-end mb-14 flex-wrap gap-6">
        <div>
          {data?.subtitle && <div className="eyebrow text-camel mb-3">{data.subtitle}</div>}
          {data?.title && <h2 className="font-display text-4xl">{data.title}</h2>}
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-9 md:gap-x-9 md:gap-y-16">
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

// Restored to the original's full-width statement band: the quote sits
// centered on its own tinted chapter of the page, the way "We make fewer
// things…" did on the first landing page, rather than floating on the same
// paper as the sections around it.
function Philosophy({ data }) {
  return (
    <section className="bg-paper-dim">
      <div className="text-center max-w-3xl mx-auto px-6 py-32 md:py-44">
        <Reveal variant="fade">
          <div className="w-px h-14 bg-ink/25 mx-auto mb-10" aria-hidden="true" />
          {data.subtitle && <div className="eyebrow text-camel mb-6">{data.subtitle}</div>}
        </Reveal>
        {data.title && (
          <Reveal variant="rise" delay={140}>
            <h2 className="font-display text-3xl md:text-5xl leading-snug">{data.title}</h2>
          </Reveal>
        )}
        {data.content?.body && (
          <Reveal variant="fade" delay={280}>
            <p className="text-[15px] text-ink/70 mt-8 leading-loose max-w-xl mx-auto">{data.content.body}</p>
          </Reveal>
        )}
      </div>
    </section>
  );
}
