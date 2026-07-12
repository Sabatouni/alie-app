import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ProductCard from '../components/ProductCard';
import CountdownBlock from '../components/CountdownBlock';

export default function Collections() {
  const { slug } = useParams();
  const [products, setProducts] = useState([]);
  const [collection, setCollection] = useState(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      let query = supabase
        .from('alie_products')
        .select('*, product_images:alie_product_images(*), product_variants:alie_product_variants(*), collections:alie_collections(name,slug)')
        .eq('status', 'published');

      if (slug) {
        const { data: col } = await supabase.from('alie_collections').select('*').eq('slug', slug).single();
        setCollection(col);
        if (col) query = query.eq('collection_id', col.id);
      } else {
        setCollection(null);
      }

      const [{ data: prods }, { data: settings }] = await Promise.all([
        query.order('created_at', { ascending: false }),
        supabase.from('alie_site_settings').select('*').eq('key', 'brand').single(),
      ]);
      setProducts(prods || []);
      setWhatsapp(settings?.value?.whatsapp_number || '');
      setLoading(false);
    }
    load();
  }, [slug]);

  return (
    <div className="pt-32 px-6 md:px-14 pb-32">
      <div className="mb-14">
        <div className="eyebrow text-camel mb-3">{collection ? collection.name : 'All Collections'}</div>
        <h1 className="font-display text-4xl md:text-5xl">{collection?.description || 'Every piece, one place.'}</h1>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-9">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] bg-stone/40 animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="text-ink/60">No published products in this collection yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-9">
          {products.map((p) => <ProductCard key={p.id} product={p} whatsappNumber={whatsapp} />)}
        </div>
      )}
      <CountdownBlock locationKey="collection_page" />
    </div>
  );
}
