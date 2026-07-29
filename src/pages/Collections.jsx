import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../context/SettingsContext';
import ProductCard from '../components/ProductCard';
import CountdownBlock from '../components/CountdownBlock';
import Reveal from '../components/Reveal';
import { setMeta } from '../lib/seo';

const SELECT = '*, product_images:alie_product_images(*), product_variants:alie_product_variants(*), collections:alie_collections(name,slug)';

export default function Collections() {
  const { slug } = useParams();
  const { brand } = useSettings();
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [collection, setCollection] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | missing

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');

      // The chip row needs every active collection regardless of which one is open.
      const collectionsPromise = supabase
        .from('alie_collections')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('sort_order');

      let current = null;
      if (slug) {
        // maybeSingle, not single: an unknown slug is a 404, not an exception.
        const { data: col } = await supabase.from('alie_collections').select('*').eq('slug', slug).maybeSingle();
        if (cancelled) return;
        if (!col) { setStatus('missing'); return; }
        current = col;
      }

      let query = supabase.from('alie_products').select(SELECT).eq('status', 'published');
      if (current) query = query.eq('collection_id', current.id);

      const [{ data: prods }, { data: cols }] = await Promise.all([
        query.order('created_at', { ascending: false }),
        collectionsPromise,
      ]);
      if (cancelled) return;

      setCollection(current);
      setProducts(prods || []);
      setCollections(cols || []);
      setStatus('ready');

      setMeta({
        title: `${current?.name || 'Collections'} — ${brand.name || 'ALIÈ'}`,
        description: current?.description || '',
        image: current?.banner_image_url,
      });
    }

    load();
    return () => { cancelled = true; };
  }, [slug, brand.name]);

  if (status === 'missing') {
    return (
      <div className="pt-40 px-6 pb-40 text-center">
        <div className="eyebrow text-camel mb-3">Not found</div>
        <h1 className="font-display text-4xl">No such collection</h1>
        <Link to="/collections" className="link-underline inline-block mt-8 text-[11px] tracking-[0.16em] uppercase pb-1">
          See everything
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-32 px-6 md:px-14 pb-32">
      <Reveal variant="rise" className="mb-10 max-w-3xl">
        <div className="eyebrow text-camel mb-3">{collection ? collection.name : 'All Collections'}</div>
        <h1 className="font-display text-4xl md:text-5xl leading-tight">
          {collection?.description || collection?.name || 'Every piece'}
        </h1>
      </Reveal>

      {collections.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-12">
          <Link to="/collections" className={`badge-pill ${!slug ? 'bg-ink text-paper border-ink' : ''}`}>All</Link>
          {collections.map((c) => (
            <Link
              key={c.id}
              to={`/collections/${c.slug}`}
              className={`badge-pill ${slug === c.slug ? 'bg-ink text-paper border-ink' : ''}`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {status === 'loading' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-9">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] skeleton" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">No published products in this collection yet.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-9 md:gap-y-16">
          {products.map((p, i) => (
            <Reveal key={p.id} variant="rise" delay={(i % 4) * 90}>
              <ProductCard product={p} whatsappNumber={brand.whatsapp_number} />
            </Reveal>
          ))}
        </div>
      )}

      <CountdownBlock locationKey="collection_page" />
    </div>
  );
}
