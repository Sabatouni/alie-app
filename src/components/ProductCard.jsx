import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import ImageSlot from './ImageSlot';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';

export default function ProductCard({ product, whatsappNumber }) {
  const toast = useToast();
  const variants = product.product_variants || [];
  const colors = [...new Map(variants.map((v) => [v.color_name, v])).values()];
  const sizes = [...new Set(variants.map((v) => v.size))];
  const [color, setColor] = useState(colors[0]?.color_name || null);
  const [size, setSize] = useState(sizes[0] || null);
  const [qty, setQty] = useState(1);
  const [wishlisted, setWishlisted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const primaryImage = product.product_images?.find((i) => i.is_primary) || product.product_images?.[0];

  const orderViaWhatsApp = async () => {
    if (!whatsappNumber) {
      toast?.error('Add a WhatsApp order number under Admin → Site Settings before customers can order.');
      return;
    }
    if (sizes.length > 0 && !size) {
      toast?.error('Select a size first.');
      return;
    }

    setSubmitting(true);
    const message = `Hello, I would like to order:\n\nProduct: ${product.name}\n${color ? `Colour: ${color}\n` : ''}${size ? `Size: ${size}\n` : ''}Price: $${product.price}\nQuantity: ${qty}\nCollection: ${product.collections?.name || ''}`;

    const { error } = await supabase.from('alie_orders').insert({
      items: [{ product_id: product.id, name: product.name, color, size, price: product.price, quantity: qty }],
      subtotal: product.price * qty,
      whatsapp_message: message,
      status: 'pending',
    });
    setSubmitting(false);

    if (error) {
      toast?.error("Couldn't start the order — try again.");
      return;
    }
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="flex flex-col group">
      <div className="relative aspect-[3/4] overflow-hidden bg-stone/20">
        {product.is_new && (
          <span className="absolute top-3.5 left-3.5 z-10 text-[9px] tracking-[0.16em] uppercase px-2.5 py-1.5 bg-paper text-ink">New</span>
        )}
        {product.is_limited && (
          <span className="absolute top-3.5 left-3.5 z-10 text-[9px] tracking-[0.16em] uppercase px-2.5 py-1.5 bg-camel text-paper">Limited</span>
        )}
        <button
          onClick={() => setWishlisted((w) => !w)}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wishlisted}
          className="absolute top-3.5 right-3.5 z-10 w-8 h-8 flex items-center justify-center bg-paper/85 hover:bg-paper transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <Heart size={14} strokeWidth={1.3} fill={wishlisted ? 'currentColor' : 'none'} className={wishlisted ? 'text-camel' : 'text-ink'} />
        </button>
        <Link to={`/product/${product.slug}`} className="block w-full h-full transition-transform duration-700 ease-out group-hover:scale-105">
          <ImageSlot src={primaryImage?.url} alt={product.name} tone="sand" />
        </Link>
      </div>

      <div className="pt-4">
        <div className="text-[10px] tracking-[0.16em] uppercase text-camel">{product.category}</div>
        <Link to={`/product/${product.slug}`}>
          <h3 className="font-display text-lg mt-1 hover:text-camel transition-colors duration-300">{product.name}</h3>
        </Link>
        <div className="text-sm text-ink/60 mt-1 tabular-nums">${product.price}</div>

        {colors.length > 0 && (
          <div className="flex gap-2 mt-3.5">
            {colors.map((c) => (
              <button
                key={c.color_name}
                onClick={() => setColor(c.color_name)}
                title={c.color_name}
                aria-label={`Colour: ${c.color_name}`}
                aria-pressed={color === c.color_name}
                className="w-6 h-6 flex items-center justify-center focus:outline-none"
              >
                <span
                  style={{ background: c.color_hex || '#ccc' }}
                  className={`block w-4 h-4 rounded-full border border-ink/15 transition-transform duration-200 ${
                    color === c.color_name ? 'scale-125 ring-1 ring-ink ring-offset-1 ring-offset-paper' : ''
                  }`}
                />
              </button>
            ))}
          </div>
        )}

        {sizes.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                aria-pressed={size === s}
                className={`text-[10px] min-w-[34px] px-2.5 py-1.5 border transition-colors duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-ink ${
                  size === s ? 'bg-ink text-paper border-ink' : 'border-ink/20 hover:border-ink/50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2.5 mt-4">
          <div className="flex items-center border border-ink/20">
            <button
              aria-label="Decrease quantity"
              className="w-7 h-8 text-sm hover:bg-ink/5 transition-colors disabled:opacity-30"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
            >
              −
            </button>
            <span className="w-6 text-center text-xs tabular-nums">{qty}</span>
            <button
              aria-label="Increase quantity"
              className="w-7 h-8 text-sm hover:bg-ink/5 transition-colors disabled:opacity-30"
              onClick={() => setQty((q) => Math.min(9, q + 1))}
              disabled={qty >= 9}
            >
              +
            </button>
          </div>
          <button
            onClick={orderViaWhatsApp}
            disabled={submitting}
            className="flex-1 text-[10px] tracking-[0.1em] uppercase border border-ink py-2.5 text-center transition-colors duration-300 hover:bg-ink hover:text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-50"
          >
            {submitting ? 'Starting Order…' : 'Order via WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}
