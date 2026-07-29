import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ImageSlot from './ImageSlot';

// Drop this anywhere with a locationKey. If no admin-enabled countdown targets
// that location, it renders null — no wrapper, no padding, no empty section.
// Parents must not wrap it in a spaced container for the same reason.
//
// The completion CTA used to build `/product/${countdown.product_id}`, which is
// a UUID; the product route matches on slug, so every finished countdown linked
// to a dead URL. The linked row's slug is now resolved before rendering.

export default function CountdownBlock({ locationKey }) {
  const [countdown, setCountdown] = useState(null);
  const [target, setTarget] = useState(null); // { href } | null
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from('alie_countdowns')
        .select('*')
        .eq('is_enabled', true)
        .eq('location_key', locationKey)
        .order('created_at', { ascending: false })
        .limit(1);

      const row = data?.[0] || null;
      if (cancelled) return;
      setCountdown(row);
      if (!row) { setTarget(null); return; }

      const resolved = await resolveTarget(row);
      if (!cancelled) setTarget(resolved);
    }

    load();
    return () => { cancelled = true; };
  }, [locationKey]);

  useEffect(() => {
    if (!countdown) { setRemaining(null); return; }
    const at = new Date(countdown.target_at).getTime();
    const tick = () => setRemaining(Math.max(0, at - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [countdown]);

  // Nothing at all until a countdown is both found and ticking.
  if (!countdown || remaining === null) return null;

  const done = remaining === 0;
  const pad = (n) => String(n).padStart(2, '0');
  const d = Math.floor(remaining / 86400000);
  const h = Math.floor((remaining % 86400000) / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);

  return (
    <section className="relative bg-smoke text-paper py-28 md:py-36 px-6 text-center overflow-hidden">
      {countdown.banner_image_url && (
        <div className="absolute inset-0 opacity-25">
          <ImageSlot src={countdown.banner_image_url} alt="" tone="mist" sizes="100vw" />
        </div>
      )}
      <div className="relative z-10">
        <div className="eyebrow text-camel-soft mb-4">Limited Editions</div>
        <h2 className="font-display text-3xl md:text-5xl max-w-xl mx-auto">{countdown.title}</h2>

        {!done ? (
          <div className="flex justify-center gap-10 md:gap-12 mt-14 flex-wrap">
            {[[d, 'Days'], [h, 'Hours'], [m, 'Minutes'], [s, 'Seconds']].map(([val, label]) => (
              <div key={label}>
                <div className="font-display text-5xl md:text-7xl text-camel-soft tabular-nums">{pad(val)}</div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-paper/60 mt-2">{label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-14">
            {target ? (
              <Link
                to={target.href}
                className="inline-block text-xs tracking-[0.18em] uppercase border border-paper px-9 py-4 hover:bg-paper hover:text-smoke transition-colors"
              >
                {countdown.completion_message || 'Now Available'}
              </Link>
            ) : (
              // No reachable target: show the message as text rather than a dead link.
              <span className="inline-block text-xs tracking-[0.18em] uppercase border border-paper/40 px-9 py-4 text-paper/70">
                {countdown.completion_message || 'Now Available'}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// Countdowns can point at a product, collection, event or collaboration. Only
// products and collections have public detail routes; the other two link to
// their index page.
async function resolveTarget(row) {
  if (row.product_id) {
    const { data } = await supabase.from('alie_products').select('slug, status').eq('id', row.product_id).maybeSingle();
    return data?.slug && data.status === 'published' ? { href: `/product/${data.slug}` } : null;
  }
  if (row.collection_id) {
    const { data } = await supabase.from('alie_collections').select('slug, is_active').eq('id', row.collection_id).maybeSingle();
    return data?.slug && data.is_active ? { href: `/collections/${data.slug}` } : null;
  }
  if (row.event_id) return { href: '/events' };
  if (row.collaboration_id) return { href: '/collaborations' };
  return null;
}
