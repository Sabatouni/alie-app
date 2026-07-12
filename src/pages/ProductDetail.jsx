import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ImageSlot from '../components/ImageSlot';
import ProductCard from '../components/ProductCard';
import CountdownBlock from '../components/CountdownBlock';

export default function ProductDetail() {
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [whatsapp, setWhatsapp] = useState('');
  const [activeImg, setActiveImg] = useState(0);
  const [openSection, setOpenSection] = useState('materials');

  useEffect(() => {
    async function load() {
      const { data: p } = await supabase
        .from('alie_products')
        .select('*, product_images:alie_product_images(*), product_variants:alie_product_variants(*), collections:alie_collections(id,name,slug)')
        .eq('slug', slug)
        .single();
      setProduct(p);
      if (p?.collection_id) {
        const { data: rel } = await supabase
          .from('alie_products')
          .select('*, product_images:alie_product_images(*), product_variants:alie_product_variants(*), collections:alie_collections(name)')
          .eq('collection_id', p.collection_id)
          .neq('id', p.id)
          .eq('status', 'published')
          .limit(4);
        setRelated(rel || []);
      }
      const { data: settings } = await supabase.from('alie_site_settings').select('*').eq('key', 'brand').single();
      setWhatsapp(settings?.value?.whatsapp_number || '');

      if (p) {
        document.title = p.seo_title || `${p.name} — ALIÈ`;
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'description';
          document.head.appendChild(meta);
        }
        meta.content = p.seo_description || p.description || '';
      }
    }
    load();
  }, [slug]);

  if (!product) {
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

  const images = product.product_images?.length ? product.product_images : [{}];
  const sections = [
    ['materials', 'Materials & Fabric', product.fabric],
    ['fit', 'Fit & Sizing', 'True to size. See sizing guide for full measurements.'],
    ['care', 'Care Instructions', product.care_instructions],
    ['delivery', 'Availability & Delivery', `${product.stock_count} in stock · estimated delivery 3–7 days`],
  ];

  return (
    <div className="pt-28 px-6 md:px-14 pb-32">
      <div className="grid md:grid-cols-2 gap-14">
        <div>
          <div className="aspect-[3/4]"><ImageSlot src={images[activeImg]?.url} tone="sand" /></div>
          <div className="flex gap-2 mt-3">
            {images.map((img, i) => (
              <button key={i} onClick={() => setActiveImg(i)} className={`w-16 h-20 border ${activeImg === i ? 'border-ink' : 'border-transparent'}`}>
                <ImageSlot src={img.url} tone="stone" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="eyebrow text-camel mb-3">{product.collections?.name || product.category}</div>
          <h1 className="font-display text-4xl md:text-5xl">{product.name}</h1>
          <div className="text-lg mt-3 text-ink/70">${product.price}</div>
          {product.story && <p className="text-[15px] leading-relaxed text-ink/70 mt-6 max-w-md">{product.story}</p>}

          <div className="mt-10 divide-y divide-ink/10 border-t border-ink/10">
            {sections.filter(([, , val]) => val).map(([key, label, val]) => (
              <div key={key}>
                <button
                  onClick={() => setOpenSection(openSection === key ? null : key)}
                  className="w-full flex justify-between items-center py-4 text-left text-[13px] tracking-[0.06em] uppercase"
                >
                  {label}
                  <span>{openSection === key ? '−' : '+'}</span>
                </button>
                {openSection === key && <p className="pb-4 text-sm text-ink/65 leading-relaxed">{val}</p>}
              </div>
            ))}
          </div>

          <ProductCardActions product={product} whatsapp={whatsapp} />
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-32">
          <h2 className="font-display text-3xl mb-10">You may also like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-9">
            {related.map((p) => <ProductCard key={p.id} product={p} whatsappNumber={whatsapp} />)}
          </div>
        </div>
      )}

      <Link to="/collections" className="inline-block mt-16 text-[11px] tracking-[0.16em] uppercase border-b border-ink pb-1">
        ← Back to Collections
      </Link>

      <CountdownBlock locationKey="product_page" />
    </div>
  );
}

// Standalone order block (kept separate from the grid ProductCard, which is compact for listings)
function ProductCardActions({ product, whatsapp }) {
  return (
    <div className="mt-10">
      <ProductCard product={product} whatsappNumber={whatsapp} />
    </div>
  );
}
