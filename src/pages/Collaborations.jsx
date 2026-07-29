import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../context/SettingsContext';
import ImageSlot from '../components/ImageSlot';
import { setMeta } from '../lib/seo';

// The Collaborations admin has existed since 0001; nothing on the storefront
// read it, and the Nav linked to a /collaborations route that didn't exist.

const STATUS_ORDER = { active: 0, upcoming: 1, past: 2 };

export default function Collaborations() {
  const { brand } = useSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMeta({
      title: `Collaborations — ${brand.name || 'ALIÈ'}`,
      description: 'Partnerships and joint collections.',
    });

    supabase
      .from('alie_collaborations')
      .select('*, media:alie_collaboration_media(*)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRows([...(data || [])].sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)));
        setLoading(false);
      });
  }, [brand.name]);

  return (
    <div className="pt-32 px-6 md:px-14 pb-32">
      <div className="mb-14">
        <div className="eyebrow text-camel mb-3">Collaborations</div>
        <h1 className="font-display text-4xl md:text-5xl">Work made with others</h1>
      </div>

      {loading ? (
        <div className="space-y-16">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="grid md:grid-cols-2 gap-10">
              <div className="aspect-[4/3] skeleton" />
              <div className="space-y-3">
                <div className="skeleton h-3 w-24" />
                <div className="skeleton h-9 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">No collaborations published yet.</div>
      ) : (
        <div className="space-y-24">
          {rows.map((c, i) => {
            const media = [...(c.media || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
            return (
              <article key={c.id} className="grid md:grid-cols-2 gap-10 items-center">
                <div className={`aspect-[4/3] overflow-hidden bg-stone/20 ${i % 2 ? 'md:order-2' : ''}`}>
                  <ImageSlot
                    src={c.hero_image_url || media[0]?.url}
                    alt={c.title}
                    tone="camel"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    {c.logo_url && <img src={c.logo_url} alt="" className="h-7 w-auto object-contain" />}
                    <span className="badge-pill capitalize">{c.status}</span>
                  </div>
                  <div className="eyebrow text-camel mt-4">{c.partner_name}</div>
                  <h2 className="font-display text-3xl md:text-4xl mt-2">{c.title}</h2>
                  {c.story && <p className="text-[15px] text-ink/70 mt-5 leading-relaxed max-w-md whitespace-pre-line">{c.story}</p>}

                  {media.length > 1 && (
                    <div className="flex gap-2 mt-6">
                      {media.slice(1, 5).map((m) => (
                        <div key={m.id} className="w-20 h-20 overflow-hidden bg-stone/20">
                          <ImageSlot src={m.url} alt="" tone="stone" sizes="80px" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
