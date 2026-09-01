import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import { formatMoney } from '../lib/currency';

// Colour, size, quantity and the WhatsApp order button.
//
// ProductCard and ProductDetail both render this. Before, the detail page
// embedded an entire ProductCard to get these controls, which meant a second
// copy of the product image and title appeared below the accordion.
//
// Ordering is three steps: the WhatsApp button opens the customer details
// panel (name / WhatsApp / mobile / email); submitting that creates the order
// and opens WhatsApp *to ALIÈ's business number* (whatsappNumber — never the
// customer's own number, which only ever lives in the customer_* fields);
// the panel then shows an order-received confirmation with a reference the
// customer can track later without an account.

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

// Generated client-side rather than read back from the insert: `alie_orders`
// has no anon SELECT policy (by design — customers can't read order data),
// so a `.insert().select()` round-trip would fail. Computing both values up
// front means the confirmation screen and the WhatsApp message always agree
// with what's actually in the database, with no second request needed.
function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateOrderNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `ALIE-${yy}${mm}${dd}-${randomHex(3)}`;
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
  const [confirmation, setConfirmation] = useState(null); // { orderNumber, trackingToken, whatsappUrl }

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
    setConfirmation(null);
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
    const orderNumber = generateOrderNumber();
    const trackingToken = randomHex(16);

    const message =
      `ALIÈ — ORDER REQUEST\n\n` +
      `ORDER\n----------------\n` +
      `Product: ${product.name}\n` +
      `${color ? `Colour: ${color}\n` : ''}` +
      `${size ? `Size: ${size}\n` : ''}` +
      `Quantity: ${qty}\n` +
      `Unit Price: ${formatMoney(unitPrice, 'TZS')}\n` +
      `Total: ${formatMoney(subtotal, 'TZS')}\n\n` +
      `CUSTOMER\n----------------\n` +
      `Name: ${name}\n` +
      `WhatsApp: ${whatsapp}\n` +
      `Mobile: ${mobile}\n` +
      `Email: ${email}\n\n` +
      `ORDER STATUS\n----------------\n` +
      `Pending\n\n` +
      `Please confirm availability and next steps.`;

    // The order is only ever "received", never "confirmed" — status starts
    // pending and only an admin moves it forward, so the WhatsApp message
    // above says Pending regardless of anything the customer sees next.
    const { error } = await supabase.from('alie_orders').insert({
      order_number: orderNumber,
      tracking_token: trackingToken,
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
      // And don't show a confirmation screen: the order was NOT received.
      toast?.error("Couldn't start the order — try again.");
      return;
    }

    // whatsappNumber is ALIÈ's own business number (SettingsContext →
    // brand.whatsapp_number, from alie_site_settings) — the destination is
    // never the customer's own number, which is only ever in the fields above.
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    if (tab && !tab.closed) tab.location.href = whatsappUrl;
    else window.location.href = whatsappUrl; // popup blocked: don't drop the customer

    setConfirmation({ orderNumber, trackingToken, whatsappUrl, name });
  }

  function closeConfirmation() {
    setShowDetails(false);
    setConfirmation(null);
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
            onClick={() => !submitting && (confirmation ? closeConfirmation() : setShowDetails(false))}
            className="absolute inset-0 bg-ink/40"
          />
          {confirmation ? (
            <div className="relative bg-paper w-full sm:max-w-sm max-h-[92vh] overflow-y-auto p-6 sm:p-7 border-t sm:border border-ink/10 animate-[fadeIn_0.25s_ease]">
              <div className="flex items-start justify-between mb-4">
                <h2 className="font-display text-xl">✓ Order Received</h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={closeConfirmation}
                  className="text-ink/40 hover:text-ink transition-colors text-lg leading-none p-1 -mr-1 -mt-1"
                >
                  ×
                </button>
              </div>

              <p className="text-sm text-ink/70">
                Thank you, {confirmation.name.split(' ')[0]}. Your order has been received.
              </p>

              <div className="mt-6 border border-ink/10 p-4">
                <div className="field-label">Order Reference</div>
                <div className="font-mono text-sm tracking-wide">{confirmation.orderNumber}</div>
                <div className="field-label mt-4">Status</div>
                <div className="text-sm uppercase tracking-[0.08em]">Pending</div>
              </div>

              <p className="text-xs text-ink/50 mt-4">
                We'll contact you on WhatsApp once your order has been reviewed. A WhatsApp message
                to ALIÈ should have opened in a new tab with your order details.
              </p>

              <a
                href={confirmation.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-link block text-center mt-4 text-xs"
              >
                WhatsApp didn't open? Contact us
              </a>

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={closeConfirmation} className="btn-primary flex-1">
                  Continue Shopping
                </button>
                <Link
                  to={`/track/${confirmation.trackingToken}`}
                  onClick={closeConfirmation}
                  className="flex-1 flex items-center justify-center border border-ink/20 text-[11px] tracking-[0.08em] uppercase hover:border-ink transition-colors"
                >
                  Track Order
                </Link>
              </div>
            </div>
          ) : (
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
          )}
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
