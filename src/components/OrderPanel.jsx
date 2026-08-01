import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';

// Colour, size, quantity and the WhatsApp order button.
//
// ProductCard and ProductDetail both render this. Before, the detail page
// embedded an entire ProductCard to get these controls, which meant a second
// copy of the product image and title appeared below the accordion.

export default function OrderPanel({ product, whatsappNumber, size: sizeClass = 'compact' }) {
  const toast = useToast();
  const variants = product.product_variants || [];
  const colors = [...new Map(variants.map((v) => [v.color_name, v])).values()];

  const [color, setColor] = useState(colors[0]?.color_name || null);

  // Sizes are filtered by the selected colour: offering an XL that exists only
  // in one colourway lets a customer order something that isn't stocked.
  const sizesForColor = [...new Set(
    variants.filter((v) => !color || v.color_name === color).map((v) => v.size)
  )];
  const [size, setSize] = useState(sizesForColor[0] || null);
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (size && !sizesForColor.includes(size)) setSize(sizesForColor[0] || null);
  }, [color]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedVariant = variants.find((v) => v.color_name === color && v.size === size);
  const outOfStock = variants.length > 0
    ? !selectedVariant || selectedVariant.stock <= 0
    : product.stock_count === 0;

  const large = sizeClass === 'large';

  async function orderViaWhatsApp() {
    if (!whatsappNumber) {
      toast?.error('Add a WhatsApp order number under Admin → Site Settings before customers can order.');
      return;
    }
    if (sizesForColor.length > 0 && !size) {
      toast?.error('Select a size first.');
      return;
    }

    // The tab must be opened synchronously, inside the click. Opening it after
    // `await` puts it outside the user-gesture window, and Safari and iOS block
    // it — the order row got created and the customer saw nothing happen.
    const tab = window.open('', '_blank', 'noopener');

    setSubmitting(true);
    const message =
      `Hello, I would like to order:\n\nProduct: ${product.name}\n` +
      `${color ? `Colour: ${color}\n` : ''}${size ? `Size: ${size}\n` : ''}` +
      `Price: $${product.price}\nQuantity: ${qty}\n` +
      `${product.collections?.name ? `Collection: ${product.collections.name}\n` : ''}`;

    const { error } = await supabase.from('alie_orders').insert({
      items: [{
        product_id: product.id, name: product.name, color, size,
        price: product.price, quantity: qty,
        sku: selectedVariant?.sku || product.sku || null,
      }],
      subtotal: Number(product.price) * qty,
      whatsapp_message: message,
      status: 'pending',
    });
    setSubmitting(false);

    if (error) {
      if (tab && !tab.closed) tab.close();
      toast?.error("Couldn't start the order — try again.");
      return;
    }

    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    if (tab && !tab.closed) tab.location.href = url;
    else window.location.href = url; // popup blocked: don't drop the customer
  }

  return (
    <div>
      {colors.length > 0 && (
        <div className={large ? 'mt-8' : 'mt-3.5'}>
          {large && <div className="field-label">Colour{color ? `: ${color}` : ''}</div>}
          <div className="flex gap-2">
            {colors.map((c) => (
              <button
                key={c.color_name}
                onClick={() => setColor(c.color_name)}
                title={c.color_name}
                aria-label={`Colour: ${c.color_name}`}
                aria-pressed={color === c.color_name}
                className={`flex items-center justify-center focus:outline-none ${large ? 'w-8 h-8' : 'w-6 h-6'}`}
              >
                <span
                  style={{ background: c.color_hex || '#ccc' }}
                  className={`block rounded-full border border-ink/15 transition-transform duration-200 ${
                    large ? 'w-6 h-6' : 'w-4 h-4'
                  } ${color === c.color_name ? 'scale-125 ring-1 ring-ink ring-offset-1 ring-offset-paper' : ''}`}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {sizesForColor.length > 0 && (
        <div className={large ? 'mt-7' : 'mt-3'}>
          {large && <div className="field-label">Size</div>}
          <div className="flex gap-1.5 flex-wrap">
            {sizesForColor.map((s) => {
              const stocked = variants.some((v) => v.color_name === color && v.size === s && v.stock > 0);
              return (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  aria-pressed={size === s}
                  title={stocked ? undefined : 'Out of stock'}
                  className={`border transition-colors duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-ink ${
                    large ? 'text-xs min-w-[46px] px-3 py-2.5' : 'text-[10px] min-w-[34px] px-2.5 py-1.5'
                  } ${size === s ? 'bg-ink text-paper border-ink' : 'border-ink/20 hover:border-ink/50'} ${
                    stocked ? '' : 'opacity-40 line-through'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* An unavailable piece shows a quiet status line, not a dead button —
          there is nothing to click, so nothing should look clickable. The
          quantity stepper disappears with it. */}
      {outOfStock ? (
        <div
          role="status"
          className={`tracking-[0.1em] uppercase text-center text-ink/45 border border-ink/15 ${
            large ? 'mt-8 text-[11px] py-3.5' : 'mt-4 text-[10px] py-2.5'
          }`}
        >
          Out of Stock
        </div>
      ) : (
        <div className={`flex items-center gap-2.5 ${large ? 'mt-8' : 'mt-4'}`}>
          <div className="flex items-center border border-ink/20">
            <button
              aria-label="Decrease quantity"
              className={`text-sm hover:bg-ink/5 transition-colors disabled:opacity-30 ${large ? 'w-9 h-11' : 'w-7 h-8'}`}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              disabled={qty <= 1}
            >
              −
            </button>
            <span className={`text-center tabular-nums ${large ? 'w-8 text-sm' : 'w-6 text-xs'}`}>{qty}</span>
            <button
              aria-label="Increase quantity"
              className={`text-sm hover:bg-ink/5 transition-colors disabled:opacity-30 ${large ? 'w-9 h-11' : 'w-7 h-8'}`}
              onClick={() => setQty((q) => Math.min(9, q + 1))}
              disabled={qty >= 9}
            >
              +
            </button>
          </div>
          <button
            onClick={orderViaWhatsApp}
            disabled={submitting}
            className={`flex-1 tracking-[0.1em] uppercase border border-ink text-center transition-colors duration-300 hover:bg-ink hover:text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-50 disabled:pointer-events-none ${
              large ? 'text-[11px] py-3.5' : 'text-[10px] py-2.5'
            }`}
          >
            {submitting ? 'Starting Order…' : 'Order via WhatsApp'}
          </button>
        </div>
      )}
    </div>
  );
}
