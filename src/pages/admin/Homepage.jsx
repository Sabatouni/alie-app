import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

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
    const { error } = await supabase.from('alie_homepage_sections').update(patch).eq('id', id);
    await refresh();
    setSaving(null);
    if (error) toast.error(error.message);
  }

  async function toggle(row) {
    await update(row.id, { is_enabled: !row.is_enabled });
  }

  async function move(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const a = sections[index];
    const b = sections[target];
    await Promise.all([
      supabase.from('alie_homepage_sections').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('alie_homepage_sections').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    refresh();
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-3">Homepage</h1>
      <p className="text-sm text-ink/50 max-w-lg mb-8">
        Hide, show, reorder, and edit every homepage section. The product grid itself is data-driven
        from Products — only its title and subtitle are editable here.
      </p>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-32" />)}
        </div>
      ) : (
      <div className="space-y-4">
        {sections.map((s, i) => (
          <div key={s.id} className="card-panel">
            <div className="flex justify-between items-start gap-4 mb-4">
              <div className="text-[10px] tracking-[0.14em] uppercase text-ink/40">{s.section_key}</div>
              <div className="flex items-center gap-3">
                <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="text-sm disabled:opacity-25 hover:text-camel transition-colors">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label="Move down" className="text-sm disabled:opacity-25 hover:text-camel transition-colors">↓</button>
                <button
                  onClick={() => toggle(s)}
                  className={`badge-pill ${s.is_enabled ? 'bg-ink text-paper border-ink' : ''}`}
                >
                  {s.is_enabled ? 'Visible' : 'Hidden'}
                </button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Title</label>
                <input
                  defaultValue={s.title || ''}
                  onBlur={(e) => update(s.id, { title: e.target.value })}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label">Subtitle</label>
                <input
                  defaultValue={s.subtitle || ''}
                  onBlur={(e) => update(s.id, { subtitle: e.target.value })}
                  className="field-input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="field-label">Image URL (copy from Media Library)</label>
                <input
                  defaultValue={s.image_url || ''}
                  onBlur={(e) => update(s.id, { image_url: e.target.value })}
                  className="field-input"
                />
              </div>
            </div>
            {saving === s.id && <div className="text-[10px] text-ink/40 mt-2">Saving…</div>}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
