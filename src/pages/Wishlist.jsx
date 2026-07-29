import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../context/SettingsContext';
import ProductCard from '../components/ProductCard';
import Reveal from '../components/Reveal';
import { getWishlist, subscribeWishlist } from '../lib/wishlist';
import { setMeta } from '../lib/seo';

const SELECT = '*, product_images:alie_product_images(*), product_variants:alie_product_variants(*), collections:alie_collections(name,slug)';

export default function Wishlist() {
  const { brand } = useSettings();
  const [ids, setIds] = useState(() => getWishlist());
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMeta({ title: `Wishlist — ${brand.name || 'ALIÈ'}`, noindex: true });
    return subscribeWishlist(setIds);
  }, [brand.name]);

  useEffect(() => {
    let cancelled = false;
    if (!ids.length) { setProducts([]); setLoading(false); return; }

    setLoading(true);
    supabase
      .from('alie_products')
      .select(SELECT)
      .in('id', ids)
      .eq('status', 'published')
      .then(({ data }) => {
        if (cancelled) return;
        setProducts(data || []);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [ids]);

  return (
    <div className="pt-32 px-6 md:px-14 pb-32">
      <Reveal variant="rise" className="mb-14">
        <div className="eyebrow text-camel mb-3">Saved</div>
        <h1 className="font-display text-4xl md:text-5xl">Your wishlist</h1>
        <p className="text-xs text-ink/45 mt-4 max-w-md">
          Saved on this device. There are no customer accounts — orders go straight to WhatsApp.
        </p>
      </Reveal>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-9">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="aspect-[3/4] skeleton" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          Nothing saved yet — tap the heart on any product.
          <div className="mt-5">
            <Link to="/collections" className="link-underline text-[11px] tracking-[0.16em] uppercase pb-1 text-ink">
              Browse the collections
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-9 md:gap-y-16">
          {products.map((p, i) => (
            <Reveal key={p.id} variant="rise" delay={(i % 4) * 90}>
              <ProductCard product={p} whatsappNumber={brand.whatsapp_number} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
