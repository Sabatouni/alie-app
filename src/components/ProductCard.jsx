import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import ImageSlot from './ImageSlot';
import OrderPanel from './OrderPanel';
import { primaryProductImage } from '../lib/productImages';
import { isWishlisted, toggleWishlist } from '../lib/wishlist';

export default function ProductCard({ product, whatsappNumber }) {
  const [wishlisted, setWishlisted] = useState(false);
  useEffect(() => { setWishlisted(isWishlisted(product.id)); }, [product.id]);

  // Chosen primary, else first in sort order — the same rule the admin's
  // Images panel shows, so the card always matches what the admin sees.
  const primaryImage = primaryProductImage(product.product_images);
  const onSale = product.compare_at_price && Number(product.compare_at_price) > Number(product.price);

  return (
    <div className="flex flex-col group card-lift">
      <div className="relative aspect-[3/4] overflow-hidden bg-stone/20 card-shadow">
        {product.is_new && (
          <span className="absolute top-3.5 left-3.5 z-10 text-[9px] tracking-[0.16em] uppercase px-2.5 py-1.5 bg-paper text-ink">New</span>
        )}
        {product.is_limited && (
          <span className="absolute top-3.5 left-3.5 z-10 text-[9px] tracking-[0.16em] uppercase px-2.5 py-1.5 bg-camel text-paper">Limited</span>
        )}
        <button
          onClick={() => setWishlisted(toggleWishlist(product.id))}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wishlisted}
          className="absolute top-3.5 right-3.5 z-10 w-8 h-8 flex items-center justify-center bg-paper/85 hover:bg-paper transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <Heart size={14} strokeWidth={1.3} fill={wishlisted ? 'currentColor' : 'none'} className={wishlisted ? 'text-camel' : 'text-ink'} />
        </button>
        <Link to={`/product/${product.slug}`} className="block w-full h-full img-hover">
          <ImageSlot
            src={primaryImage?.url}
            alt={primaryImage?.alt_text || product.name}
            tone="sand"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        </Link>
      </div>

      <div className="pt-4">
        <div className="text-[10px] tracking-[0.16em] uppercase text-camel">{product.category}</div>
        <Link to={`/product/${product.slug}`}>
          <h3 className="font-display text-lg mt-1 hover:text-camel transition-colors duration-300">{product.name}</h3>
        </Link>
        <div className="text-sm text-ink/60 mt-1 tabular-nums flex items-center gap-2">
          <span>${product.price}</span>
          {onSale && <span className="line-through text-ink/35">${product.compare_at_price}</span>}
        </div>

        <OrderPanel product={product} whatsappNumber={whatsappNumber} />
      </div>
    </div>
  );
}
