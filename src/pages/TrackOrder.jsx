import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { setMeta } from '../lib/seo';
import { formatMoney } from '../lib/currency';

// A customer reaches this via the "Track Order" link shown on the order
// confirmation screen (or a bookmarked/saved link). The token in the URL is a
// high-entropy value from alie_orders.tracking_token — not the human-readable
// order number, and not a database id — so it can't be guessed or enumerated.
// The lookup goes through alie_track_order(), a function that only ever
// returns order-summary fields; it has no way to return another customer's
// name, phone, or email even if called with an arbitrary token.

const STATUS_LABEL = {
  pending: 'Pending',
  contacted: 'Contacted',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function TrackOrder() {
  const { token } = useParams();
  const [state, setState] = useState('loading'); // loading | found | not-found | error
  const [order, setOrder] = useState(null);

  useEffect(() => {
    setMeta({ title: 'Track Your Order — ALIÈ', noindex: true });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    supabase.rpc('alie_track_order', { p_token: token }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setState('error'); return; }
      if (!data || data.length === 0) { setState('not-found'); return; }
      setOrder(data[0]);
      setState('found');
    });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      {state === 'loading' && <div className="text-sm text-ink/40">Looking up your order…</div>}

      {state === 'not-found' && (
        <>
          <div className="eyebrow text-camel mb-4">Not Found</div>
          <h1 className="font-display text-3xl md:text-4xl">We couldn't find that order</h1>
          <p className="text-sm text-ink/55 mt-4 max-w-sm leading-relaxed">
            The tracking link may be incomplete or out of date. If you placed an order recently,
            the confirmation screen you saw right after ordering has a link that always works.
          </p>
        </>
      )}

      {state === 'error' && (
        <p className="text-sm text-ink/55 max-w-sm">
          Something went wrong looking up your order. Please try again in a moment.
        </p>
      )}

      {state === 'found' && order && (
        <>
          <div className="eyebrow text-camel mb-4">Order Status</div>
          <h1 className="font-display text-3xl md:text-4xl">{order.order_number}</h1>

          <div className="mt-8 border border-ink/10 p-6 w-full max-w-xs text-left">
            <div className="field-label">Status</div>
            <div className="text-lg uppercase tracking-[0.08em] mt-1">
              {STATUS_LABEL[order.status] || order.status}
            </div>

            <div className="field-label mt-5">Items</div>
            <div className="text-sm mt-1 space-y-1">
              {(order.items || []).map((it, i) => (
                <div key={i}>
                  {it.name}
                  {(it.color || it.size) && <span className="text-ink/50"> — {[it.color, it.size].filter(Boolean).join(' / ')}</span>}
                  <span className="text-ink/50"> × {it.quantity}</span>
                </div>
              ))}
            </div>

            <div className="field-label mt-5">Total</div>
            <div className="text-sm mt-1 tabular-nums">{formatMoney(order.subtotal, order.currency)}</div>

            <div className="field-label mt-5">Placed</div>
            <div className="text-sm mt-1">{new Date(order.created_at).toLocaleDateString()}</div>
          </div>

          <p className="text-xs text-ink/50 mt-6 max-w-sm">
            {order.status === 'pending' && "We'll contact you on WhatsApp once your order has been reviewed."}
            {order.status === 'contacted' && "We've reached out on WhatsApp about this order."}
            {order.status === 'completed' && 'This order has been completed. Thank you for shopping with ALIÈ.'}
            {order.status === 'cancelled' && 'This order was cancelled.'}
          </p>
        </>
      )}

      <div className="flex gap-6 mt-9 flex-wrap justify-center">
        <Link to="/" className="link-underline text-[11px] tracking-[0.16em] uppercase pb-1">Continue Shopping</Link>
      </div>
    </div>
  );
}
