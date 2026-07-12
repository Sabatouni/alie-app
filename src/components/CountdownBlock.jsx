import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ImageSlot from './ImageSlot';

// Drop this anywhere with a locationKey ('homepage_hero', 'homepage_below_arrivals',
// 'collection_page', 'product_page', 'event_page'). If no admin-enabled countdown targets
// that location, this renders null — the layout closes up as if the block never existed.
export default function CountdownBlock({ locationKey }) {
  const [countdown, setCountdown] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('alie_countdowns')
      .select('*')
      .eq('is_enabled', true)
      .eq('location_key', locationKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        setCountdown(data?.[0] || null);
        setLoading(false);
      });
  }, [locationKey]);

  useEffect(() => {
    if (!countdown) return;
    const target = new Date(countdown.target_at).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [countdown]);

  if (loading || !countdown) return null;

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
          <ImageSlot src={countdown.banner_image_url} tone="mist" />
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
            <a
              href={
                countdown.product_id ? `/product/${countdown.product_id}` :
                countdown.collection_id ? `/collections/${countdown.collection_id}` : '#'
              }
              className="inline-block text-xs tracking-[0.18em] uppercase border border-paper px-9 py-4 hover:bg-paper hover:text-smoke transition-colors"
            >
              {countdown.completion_message || 'Now Available'}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
