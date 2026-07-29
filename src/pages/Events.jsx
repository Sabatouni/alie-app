import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../context/SettingsContext';
import ImageSlot from '../components/ImageSlot';
import CountdownBlock from '../components/CountdownBlock';
import Reveal from '../components/Reveal';
import { setMeta } from '../lib/seo';

// The Events admin has existed since 0001; nothing on the storefront read it.

export default function Events() {
  const { brand } = useSettings();
  const [events, setEvents] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMeta({
      title: `Events — ${brand.name || 'ALIÈ'}`,
      description: 'Shows, launches and studio events.',
    });

    supabase
      .from('alie_events')
      .select('*, images:alie_event_images(*)')
      .neq('status', 'cancelled')
      .order('event_date', { ascending: true })
      .then(({ data }) => {
        // Partition at fetch time, not during render: reading the clock while
        // rendering makes the output depend on when React happens to re-run.
        const now = Date.now();
        const rows = data || [];
        setEvents(rows);
        setUpcoming(rows.filter((e) => e.status === 'upcoming' && (!e.event_date || new Date(e.event_date).getTime() >= now)));
        setLoading(false);
      });
  }, [brand.name]);

  const past = events.filter((e) => !upcoming.includes(e));

  return (
    <div className="pt-32 px-6 md:px-14 pb-32">
      <Reveal variant="rise" className="mb-14">
        <div className="eyebrow text-camel mb-3">Events</div>
        <h1 className="font-display text-4xl md:text-5xl">Where to find us</h1>
      </Reveal>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-10">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[16/9] skeleton" />
              <div className="skeleton h-5 w-2/3 mt-4" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state">No events scheduled right now — check back soon.</div>
      ) : (
        <>
          {upcoming.length > 0 && <EventGrid events={upcoming} />}
          {past.length > 0 && (
            <>
              <h2 className="font-display text-2xl mt-20 mb-8 text-ink/60">Past events</h2>
              <EventGrid events={past} muted />
            </>
          )}
        </>
      )}

      <CountdownBlock locationKey="event_page" />
    </div>
  );
}

function EventGrid({ events, muted = false }) {
  return (
    <div className={`grid md:grid-cols-2 gap-10 ${muted ? 'opacity-65' : ''}`}>
      {events.map((event) => {
        const gallery = [...(event.images || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        return (
          <Reveal as="article" variant="rise" key={event.id} className="group">
            <div className="aspect-[16/9] overflow-hidden bg-stone/20 card-shadow">
              <div className="w-full h-full img-hover">
                <ImageSlot
                  src={event.banner_image_url || gallery[0]?.url}
                  alt={event.title}
                  tone="mist"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </div>
            <div className="mt-5">
              <div className="flex gap-3 items-center text-[10px] tracking-[0.16em] uppercase text-camel">
                {event.event_date && (
                  <time dateTime={event.event_date}>
                    {new Date(event.event_date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                  </time>
                )}
                {event.venue && <span className="text-ink/40">{event.venue}</span>}
              </div>
              <h3 className="font-display text-2xl mt-2">{event.title}</h3>
              {event.description && <p className="text-sm text-ink/65 mt-3 leading-relaxed max-w-md">{event.description}</p>}

              {gallery.length > 1 && (
                <div className="flex gap-2 mt-4">
                  {gallery.slice(1, 5).map((img) => (
                    <div key={img.id} className="w-16 h-16 overflow-hidden bg-stone/20">
                      <ImageSlot src={img.url} alt="" tone="stone" sizes="64px" />
                    </div>
                  ))}
                </div>
              )}

              {event.registration_url && event.status === 'upcoming' && (
                <a
                  href={event.registration_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-5 text-[11px] tracking-[0.16em] uppercase border border-ink px-6 py-3 hover:bg-ink hover:text-paper transition-colors"
                >
                  Register
                </a>
              )}
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
