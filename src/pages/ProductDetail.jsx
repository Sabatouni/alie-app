import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../context/SettingsContext';
import ImageSlot from '../components/ImageSlot';
import ProductCard from '../components/ProductCard';
import OrderPanel from '../components/OrderPanel';
import CountdownBlock from '../components/CountdownBlock';
import Reveal from '../components/Reveal';
import { galleryProductImages } from '../lib/productImages';
import { isWishlisted, toggleWishlist } from '../lib/wishlist';
import { setMeta } from '../lib/seo';

const SELECT = '*, product_images:alie_product_images(*), product_variants:alie_product_variants(*), collections:alie_collections(id,name,slug)';

export default function ProductDetail() {
  const { slug } = useParams();
  const { brand } = useSettings();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | missing
  const [activeImg, setActiveImg] = useState(0);
  const [openSection, setOpenSection] = useState('materials');
  const [wishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');
      setActiveImg(0); // a new product may have fewer images than the last one

      // maybeSingle, not single: an unknown slug is a 404, not an exception.
      const { data: p } = await supabase.from('alie_products').select(SELECT).eq('slug', slug).maybeSingle();
      if (cancelled) return;

      if (!p) {
        setProduct(null);
        setStatus('missing');
        return;
      }

      setProduct(p);
      setWishlisted(isWishlisted(p.id));
      setStatus('ready');

      setMeta({
        title: p.seo_title || `${p.name} — ${brand.name || 'ALIÈ'}`,
        description: p.seo_description || p.description || '',
        image: galleryProductImages(p.product_images)[0]?.url,
      });

      if (p.collection_id) {
        const { data: rel } = await supabase
          .from('alie_products')
          .select(SELECT)
          .eq('collection_id', p.collection_id)
          .neq('id', p.id)
          .eq('status', 'published')
          .limit(4);
        if (!cancelled) setRelated(rel || []);
      } else {
        setRelated([]);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug, brand.name]);

  if (status === 'loading') {
    return (
      <div className="pt-28 px-6 md:px-14 pb-32 grid md:grid-cols-2 gap-14">
        <div className="skeleton aspect-[3/4]" />
        <div className="space-y-4">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-10 w-2/3" />
          <div className="skeleton h-5 w-20" />
        </div>
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="pt-40 px-6 pb-40 text-center">
        <div className="eyebrow text-camel mb-3">Not found</div>
        <h1 className="font-display text-4xl">This piece isn't available</h1>
        <p className="text-sm text-ink/55 mt-4">It may have been archived or the link is out of date.</p>
        <Link to="/collections" className="link-underline inline-block mt-8 text-[11px] tracking-[0.16em] uppercase pb-1">
          Browse the collections
        </Link>
      </div>
    );
  }

  const gallery = galleryProductImages(product.product_images);
  const images = gallery.length ? gallery : [{}];
  const onSale = product.compare_at_price && Number(product.compare_at_price) > Number(product.price);
  const sections = [
    ['description', 'Description', product.description],
    ['materials', 'Materials & Fabric', product.fabric],
    ['care', 'Care Instructions', product.care_instructions],
    ['delivery', 'Availability & Delivery', product.stock_count ? `${product.stock_count} in stock · estimated delivery 3–7 days` : null],
  ].filter(([, , value]) => value);

  return (
    <div className="pt-28 px-6 md:px-14 pb-32">
      <div className="grid md:grid-cols-2 gap-14">
        <div>
          <Reveal variant="mask" className="aspect-[3/4] overflow-hidden">
            <ImageSlot
              src={images[activeImg]?.url}
              alt={images[activeImg]?.alt_text || product.name}
              tone="sand"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          </Reveal>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {images.map((img, i) => (
                <button
                  key={img.id || i}
                  onClick={() => setActiveImg(i)}
                  aria-label={`View image ${i + 1} of ${images.length}`}
                  aria-pressed={activeImg === i}
                  className={`w-16 h-20 border ${activeImg === i ? 'border-ink' : 'border-transparent'}`}
                >
                  <ImageSlot src={img.url} alt="" tone="stone" sizes="64px" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow text-camel mb-3">
                {product.collections?.slug ? (
                  <Link to={`/collections/${product.collections.slug}`} className="hover:text-ink transition-colors">
                    {product.collections.name}
                  </Link>
                ) : (
                  product.category
                )}
              </div>
              <h1 className="font-display text-4xl md:text-5xl">{product.name}</h1>
            </div>
            <button
              onClick={() => setWishlisted(toggleWishlist(product.id))}
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={wishlisted}
              className="mt-1 w-10 h-10 flex items-center justify-center border border-ink/15 hover:border-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              <Heart size={16} strokeWidth={1.3} fill={wishlisted ? 'currentColor' : 'none'} className={wishlisted ? 'text-camel' : 'text-ink'} />
            </button>
          </div>

          <div className="text-lg mt-3 text-ink/70 flex items-center gap-3 tabular-nums">
            <span>${product.price}</span>
            {onSale && <span className="text-base line-through text-ink/35">${product.compare_at_price}</span>}
          </div>

          {product.story && <p className="text-[15px] leading-relaxed text-ink/70 mt-6 max-w-md">{product.story}</p>}

          <OrderPanel product={product} whatsappNumber={brand.whatsapp_number} size="large" />

          {sections.length > 0 && (
            <div className="mt-12 divide-y divide-ink/10 border-t border-ink/10">
              {sections.map(([key, label, val]) => (
                <div key={key}>
                  <button
                    onClick={() => setOpenSection(openSection === key ? null : key)}
                    aria-expanded={openSection === key}
                    className="w-full flex justify-between items-center py-4 text-left text-[13px] tracking-[0.06em] uppercase"
                  >
                    {label}
                    <span aria-hidden="true">{openSection === key ? '−' : '+'}</span>
                  </button>
                  {openSection === key && <p className="pb-4 text-sm text-ink/65 leading-relaxed whitespace-pre-line">{val}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-32">
          <Reveal variant="rise">
            <h2 className="font-display text-3xl mb-10">You may also like</h2>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-9 md:gap-y-16">
            {related.map((p, i) => (
              <Reveal key={p.id} variant="rise" delay={(i % 4) * 90}>
                <ProductCard product={p} whatsappNumber={brand.whatsapp_number} />
              </Reveal>
            ))}
          </div>
        </div>
      )}

      <Link to="/collections" className="link-underline inline-block mt-16 text-[11px] tracking-[0.16em] uppercase pb-1">
        ← Back to Collections
      </Link>

      <CountdownBlock locationKey="product_page" />
    </div>
  );
}
