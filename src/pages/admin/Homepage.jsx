import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import ImageField from '../../components/admin/ImageField';

// Every string the homepage renders lives in this table. The storefront no
// longer carries fallback marketing copy, so anything left blank here simply
// doesn't render — which is what "hide this line" should mean.

const SECTION_HELP = {
  hero: 'Full-screen opening section. Body text and the button label come from the fields below.',
  featured_collection: 'Two-column image + copy block.',
  arrivals: 'The four most recently published products. Only the heading is editable.',
  featured_products: 'Products flagged Featured in Products. Hidden automatically when none are flagged.',
  philosophy: 'Centred statement block.',
};

const KNOWN_KEYS = Object.keys(SECTION_HELP);

export default function Homepage() {
  const toast = useToast();
  const [sections, setSections] = useState([]);
  const [saving, setSaving] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const { data, error } = await supabase.from('alie_homepage_sections').select('*').order('sort_order');
    if (error) toast.error(error.message);
    setSections(data || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function update(id, patch) {
    setSaving(id);
    setSections((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await supabase.from('alie_homepage_sections').update(patch).eq('id', id);
    setSaving(null);
    if (error) { toast.error(error.message); refresh(); }
  }

  function updateContent(section, key, value) {
    update(section.id, { content: { ...(section.content || {}), [key]: value } });
  }

  async function move(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;

    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);

    // Renumber every row rather than swapping two sort_order values. Swapping
    // is a no-op whenever the two rows happen to share a value, which is the
    // default state for any row inserted without an explicit order.
    setSections(reordered);
    const { error } = await supabase
      .from('alie_homepage_sections')
      .upsert(reordered.map((s, i) => ({ ...s, sort_order: i })), { onConflict: 'id' });
    if (error) toast.error(error.message);
    refresh();
  }

  // Sections the storefront has no renderer for would be invisible no matter
  // what an admin typed — say so rather than letting them edit into a void.
  const unknown = sections.filter((s) => !KNOWN_KEYS.includes(s.section_key));

  return (
    <div>
      <h1 className="font-display text-3xl mb-3">Homepage</h1>
      <p className="text-sm text-ink/50 max-w-xl mb-8">
        Hide, show, reorder and edit every homepage section. Blank fields render nothing at all —
        there is no fallback copy behind them.
      </p>

      {unknown.length > 0 && (
        <p role="alert" className="text-sm text-red-700 border border-red-200 bg-red-50 px-3.5 py-3 mb-6">
          The storefront has no renderer for: {unknown.map((s) => s.section_key).join(', ')}. These rows
          will not appear on the site.
        </p>
      )}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-40" />)}
        </div>
      ) : sections.length === 0 ? (
        <div className="empty-state">No homepage sections found — run migration 0001.</div>
      ) : (
        <div className="space-y-4">
          {sections.map((s, i) => (
            <div key={s.id} className={`card-panel ${s.is_enabled ? '' : 'opacity-60'}`}>
              <div className="flex justify-between items-start gap-4 mb-1">
                <div className="text-[10px] tracking-[0.14em] uppercase text-ink/40">{s.section_key}</div>
                <div className="flex items-center gap-3">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="text-sm disabled:opacity-25 hover:text-camel transition-colors">↑</button>
                  <button onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label="Move down" className="text-sm disabled:opacity-25 hover:text-camel transition-colors">↓</button>
                  <button
                    onClick={() => update(s.id, { is_enabled: !s.is_enabled })}
                    aria-pressed={s.is_enabled}
                    className={`badge-pill ${s.is_enabled ? 'bg-ink text-paper border-ink' : ''}`}
                  >
                    {s.is_enabled ? 'Visible' : 'Hidden'}
                  </button>
                </div>
              </div>
              {SECTION_HELP[s.section_key] && (
                <p className="text-xs text-ink/45 mb-5">{SECTION_HELP[s.section_key]}</p>
              )}

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="field-label">Title</label>
                  <input
                    defaultValue={s.title || ''}
                    onBlur={(e) => { if (e.target.value !== (s.title || '')) update(s.id, { title: e.target.value }); }}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">Subtitle / Eyebrow</label>
                  <input
                    defaultValue={s.subtitle || ''}
                    onBlur={(e) => { if (e.target.value !== (s.subtitle || '')) update(s.id, { subtitle: e.target.value }); }}
                    className="field-input"
                  />
                </div>

                {['hero', 'featured_collection', 'philosophy'].includes(s.section_key) && (
                  <div className="md:col-span-2">
                    <label className="field-label">Body Text</label>
                    <textarea
                      defaultValue={s.content?.body || ''}
                      onBlur={(e) => { if (e.target.value !== (s.content?.body || '')) updateContent(s, 'body', e.target.value); }}
                      rows={2}
                      className="field-input"
                    />
                  </div>
                )}

                {['hero', 'featured_collection'].includes(s.section_key) && (
                  <>
                    <div>
                      <label className="field-label">Button Label</label>
                      <input
                        defaultValue={s.content?.cta_label || ''}
                        onBlur={(e) => { if (e.target.value !== (s.content?.cta_label || '')) updateContent(s, 'cta_label', e.target.value); }}
                        placeholder="Leave blank to hide the button"
                        className="field-input"
                      />
                    </div>
                    <div>
                      <label className="field-label">Button Link</label>
                      <input
                        defaultValue={s.content?.cta_href || ''}
                        onBlur={(e) => { if (e.target.value !== (s.content?.cta_href || '')) updateContent(s, 'cta_href', e.target.value); }}
                        placeholder={s.section_key === 'hero' ? '#arrivals' : '/collections'}
                        className="field-input"
                      />
                    </div>
                  </>
                )}

                {['hero', 'featured_collection'].includes(s.section_key) && (
                  <div className="md:col-span-2">
                    <ImageField
                      label="Section Image"
                      value={s.image_url}
                      onChange={(v) => update(s.id, { image_url: v })}
                    />
                  </div>
                )}
              </div>

              {saving === s.id && <div className="text-[10px] text-ink/40 mt-3">Saving…</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
