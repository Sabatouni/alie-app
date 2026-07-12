import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ProductCard from '../components/ProductCard';
import ImageSlot from '../components/ImageSlot';
import CountdownBlock from '../components/CountdownBlock';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [sections, setSections] = useState([]);
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: prods }, { data: secs }, { data: settings }] = await Promise.all([
        supabase
          .from('alie_products')
          .select('*, product_images:alie_product_images(*), product_variants:alie_product_variants(*), collections:alie_collections(name)')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(4),
        supabase.from('alie_homepage_sections').select('*').eq('is_enabled', true).order('sort_order'),
        supabase.from('alie_site_settings').select('*').eq('key', 'brand').single(),
      ]);
      setProducts(prods || []);
      setSections(secs || []);
      setWhatsapp(settings?.value?.whatsapp_number || '');
      setLoading(false);
    }
    load();
  }, []);

  const section = (key) => sections.find((s) => s.section_key === key);

  return (
    <div>
      {section('hero') && <Hero data={section('hero')} />}

      <CountdownBlock locationKey="homepage_hero" />

      {section('featured_collection') && <FeaturedCollection data={section('featured_collection')} />}

      <ArrivalsGrid data={section('arrivals')} products={products} loading={loading} whatsapp={whatsapp} />

      <CountdownBlock locationKey="homepage_below_arrivals" />

      {section('philosophy') && <Philosophy data={section('philosophy')} />}
    </div>
  );
}

function Hero({ data }) {
  return (
    <section className="relative h-screen min-h-[700px] flex flex-col justify-end overflow-hidden">
      <div className="absolute inset-0"><ImageSlot src={data.image_url} tone="sand" /></div>
      <div className="absolute inset-0 bg-gradient-to-b from-ink/15 to-ink/75" />
      <div className="relative z-10 px-6 md:px-14 pb-24 text-paper">
        <div className="eyebrow text-camel-soft mb-5">{data.subtitle}</div>
        <h1 className="font-display text-6xl md:text-[9rem] leading-none tracking-wide">{data.title}</h1>
        <p className="text-sm max-w-md mt-5 text-paper/80 leading-relaxed">
          {data.content?.body || 'Linen and cotton, cut for movement and refined ease.'}
        </p>
        <a href="#arrivals" className="inline-flex mt-8 text-[11px] tracking-[0.18em] uppercase border border-paper/50 px-7 py-4 hover:bg-paper hover:text-ink transition-colors">
          {data.content?.cta_label || 'Explore the Collection'}
        </a>
      </div>
    </section>
  );
}

function FeaturedCollection({ data }) {
  return (
    <section className="py-32 md:py-40 px-6 md:px-14 grid md:grid-cols-2 gap-0 items-stretch">
      <div className="aspect-[4/5]"><ImageSlot src={data.image_url} tone="stone" /></div>
      <div className="flex flex-col justify-center md:pl-16 pt-10 md:pt-0">
        <div className="eyebrow text-camel mb-4">Featured Collection</div>
        <h2 className="font-display text-4xl md:text-5xl leading-tight">{data.title}</h2>
        <p className="text-[15px] text-ink/70 mt-6 max-w-sm leading-relaxed">{data.subtitle}</p>
      </div>
    </section>
  );
}

function ArrivalsGrid({ data, products, loading, whatsapp }) {
  return (
    <section id="arrivals" className="px-6 md:px-14 pb-32">
      <div className="flex justify-between items-end mb-14 flex-wrap gap-6">
        <div>
          <div className="eyebrow text-camel mb-3">{data?.subtitle || 'Everyday Linen'}</div>
          <h2 className="font-display text-4xl">{data?.title || "This week's pieces"}</h2>
        </div>
        <a href="/collections" className="text-[11px] tracking-[0.16em] uppercase border-b border-ink pb-1">View all</a>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-9">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] bg-stone/40 animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="text-ink/50">No published products yet — add some in the admin dashboard.</p>
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
      <div className="eyebrow text-camel mb-6">{data.subtitle || 'Brand Philosophy'}</div>
      <h2 className="font-display text-3xl md:text-5xl leading-snug">{data.title}</h2>
    </section>
  );
}
