import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import { formatMoney } from '../lib/currency';

// Colour, size, quantity and the WhatsApp order button.
//
// ProductCard and ProductDetail both render this. Before, the detail page
// embedded an entire ProductCard to get these controls, which meant a second
// copy of the product image and title appeared below the accordion.
//
// Ordering is two steps: picking up the WhatsApp button opens the customer
// details panel (name / WhatsApp / mobile / email); submitting *that* is the
// actual order. The Supabase insert and the WhatsApp handoff only happen once
// those four fields validate.

// Accepts +255…, 0…, or any other reasonably-shaped international number —
// deliberately loose so a real customer's number is never rejected, but tight
// enough to catch "asdf" or a 3-digit typo.
function isValidPhone(value) {
  const digits = value.replace(/[\s\-().]/g, '');
  return /^\+?[0-9]{9,15}$/.test(digits);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const EMPTY_CUSTOMER = { name: '', whatsapp: '', mobile: '', email: '' };

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
  const [showDetails, setShowDetails] = useState(false);
  const [customer, setCustomer] = useState(EMPTY_CUSTOMER);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (size && !sizesForColor.includes(size)) setSize(sizesForColor[0] || null);
  }, [color]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedVariant = variants.find((v) => v.color_name === color && v.size === size);
  const outOfStock = variants.length > 0
    ? !selectedVariant || selectedVariant.stock <= 0
    : product.stock_count === 0;

  const large = sizeClass === 'large';

  // Step 1: the visible "Order via WhatsApp" button. Only opens the details
  // panel — no tab, no insert yet, so there's nothing to preserve a user
  // gesture for here.
  function openOrderDetails() {
    if (!whatsappNumber) {
      toast?.error('Add a WhatsApp order number under Admin → Site Settings before customers can order.');
      return;
    }
    if (sizesForColor.length > 0 && !size) {
      toast?.error('Select a size first.');
      return;
    }
    setErrors({});
    setShowDetails(true);
  }

  function validateCustomer() {
    const next = {};
    if (!customer.name.trim() || customer.name.trim().length < 2) {
      next.name = 'Please enter your full name.';
    }
    if (!customer.whatsapp.trim()) {
      next.whatsapp = 'Please enter your WhatsApp number.';
    } else if (!isValidPhone(customer.whatsapp)) {
      next.whatsapp = 'Please enter a valid WhatsApp number.';
    }
    if (!customer.mobile.trim()) {
      next.mobile = 'Please enter your mobile number.';
    } else if (!isValidPhone(customer.mobile)) {
      next.mobile = 'Please enter a valid mobile number.';
    }
    if (!customer.email.trim()) {
      next.email = 'Please enter your email address.';
    } else if (!isValidEmail(customer.email)) {
      next.email = 'Please enter a valid email address.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // Step 2: submitting the details panel is the real order. This is the click
  // the WhatsApp tab must open synchronously inside — opening it after the
  // `await` puts it outside the user-gesture window and Safari/iOS block it,
  // which used to leave an order row created with nothing visibly happening.
  async function submitOrder(e) {
    e.preventDefault();
    if (!validateCustomer()) return;

    const tab = window.open('', '_blank', 'noopener');

    setSubmitting(true);
    const name = customer.name.trim();
    const whatsapp = customer.whatsapp.trim();
    const mobile = customer.mobile.trim();
    const email = customer.email.trim().toLowerCase();
    const unitPrice = Number(product.price);
    const subtotal = unitPrice * qty;

    const message =
      `ALIÈ — ORDER REQUEST\n\n` +
      `Customer:\n${name}\n\n` +
      `WhatsApp:\n${whatsapp}\n\n` +
      `Mobile:\n${mobile}\n\n` +
      `Email:\n${email}\n\n` +
      `Product:\n${product.name}\n\n` +
      `${color ? `Colour:\n${color}\n\n` : ''}` +
      `${size ? `Size:\n${size}\n\n` : ''}` +
      `Quantity:\n${qty}\n\n` +
      `Unit Price:\n${formatMoney(unitPrice, 'TZS')}\n\n` +
      `Total:\n${formatMoney(subtotal, 'TZS')}\n\n` +
      `Please confirm availability and next steps.`;

    const { error } = await supabase.from('alie_orders').insert({
      customer_name: name,
      customer_whatsapp: whatsapp,
      customer_mobile: mobile,
      customer_email: email,
      items: [{
        product_id: product.id, name: product.name, color, size,
        price: unitPrice, quantity: qty,
        sku: selectedVariant?.sku || product.sku || null,
      }],
      subtotal,
      currency: 'TZS',
      whatsapp_message: message,
      status: 'pending',
    });
    setSubmitting(false);

    if (error) {
      if (tab && !tab.closed) tab.close();
      // Keep the panel open with everything the customer already typed —
      // they shouldn't have to retype four fields because of a network blip.
      toast?.error("Couldn't start the order — try again.");
      return;
    }

    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    if (tab && !tab.closed) tab.location.href = url;
    else window.location.href = url; // popup blocked: don't drop the customer

    setShowDetails(false);
    setCustomer(EMPTY_CUSTOMER);
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
            onClick={openOrderDetails}
            disabled={submitting}
            className={`flex-1 tracking-[0.1em] uppercase border border-ink text-center transition-colors duration-300 hover:bg-ink hover:text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-50 disabled:pointer-events-none ${
              large ? 'text-[11px] py-3.5' : 'text-[10px] py-2.5'
            }`}
          >
            {submitting ? 'Starting Order…' : 'Order via WhatsApp'}
          </button>
        </div>
      )}

      {showDetails && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-details-heading"
          className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center"
        >
          <button
            aria-label="Close"
            onClick={() => !submitting && setShowDetails(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <form
            onSubmit={submitOrder}
            noValidate
            className="relative bg-paper w-full sm:max-w-sm max-h-[92vh] overflow-y-auto p-6 sm:p-7 border-t sm:border border-ink/10 animate-[fadeIn_0.25s_ease]"
          >
            <div className="flex items-start justify-between mb-1">
              <h2 id="order-details-heading" className="font-display text-xl">Your Details</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => !submitting && setShowDetails(false)}
                className="text-ink/40 hover:text-ink transition-colors text-lg leading-none p-1 -mr-1 -mt-1"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-ink/50 mb-6">
              {product.name} · {qty} × {formatMoney(product.price, 'TZS')}
            </p>

            <div className="space-y-4">
              <FormField
                label="Full Name"
                value={customer.name}
                onChange={(v) => setCustomer((c) => ({ ...c, name: v }))}
                error={errors.name}
                autoComplete="name"
              />
              <FormField
                label="WhatsApp Number"
                type="tel"
                value={customer.whatsapp}
                onChange={(v) => setCustomer((c) => ({ ...c, whatsapp: v }))}
                error={errors.whatsapp}
                placeholder="+255 7XX XXX XXX"
                autoComplete="off"
              />
              <FormField
                label="Mobile Number"
                type="tel"
                value={customer.mobile}
                onChange={(v) => setCustomer((c) => ({ ...c, mobile: v }))}
                error={errors.mobile}
                placeholder="+255 6XX XXX XXX"
                autoComplete="off"
                hint="Can be the same as your WhatsApp number."
              />
              <FormField
                label="Email Address"
                type="email"
                value={customer.email}
                onChange={(v) => setCustomer((c) => ({ ...c, email: v }))}
                error={errors.email}
                autoComplete="email"
              />
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full mt-7">
              {submitting ? 'Starting Order…' : 'Continue to WhatsApp'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function FormField({ label, value, onChange, error, type = 'text', placeholder, autoComplete, hint }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        type={type}
        inputMode={type === 'tel' ? 'tel' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        className={`field-input ${error ? 'border-red-700/60' : ''}`}
      />
      {error ? (
        <p className="text-[11px] text-red-700/80 mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-ink/40 mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}
