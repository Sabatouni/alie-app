import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import ImageField from '../../components/admin/ImageField';
import GalleryPanel from '../../components/admin/GalleryPanel';
import { removeIfUnreferenced } from '../../lib/mediaUpload';

const empty = {
  title: '', slug: '', partner_name: '', story: '', status: 'upcoming',
  hero_image_url: '', logo_url: '', launch_countdown_id: '',
};

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function Collaborations() {
  // `toast` was referenced inside refresh() before it was declared in the old
  // version of this file — an error during load threw a ReferenceError instead
  // of showing a message.
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [countdowns, setCountdowns] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  async function refresh() {
    setLoading(true);
    const [{ data, error }, { data: cds }] = await Promise.all([
      supabase.from('alie_collaborations').select('*').order('created_at', { ascending: false }),
      supabase.from('alie_countdowns').select('id, title').order('created_at', { ascending: false }),
    ]);
    if (error) toast.error(error.message);
    setRows(data || []);
    setCountdowns(cds || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      story: form.story.trim() || null,
      hero_image_url: form.hero_image_url || null,
      logo_url: form.logo_url || null,
      launch_countdown_id: form.launch_countdown_id || null,
    };
    const { data, error } = editingId
      ? await supabase.from('alie_collaborations').update(payload).eq('id', editingId).select().single()
      : await supabase.from('alie_collaborations').insert(payload).select().single();
    setSaving(false);
    if (error) { toast.error(error.code === '23505' ? 'That slug is already taken.' : error.message); return; }

    if (editingId) {
      toast.success('Collaboration updated.');
    } else {
      toast.success('Collaboration created — add gallery images below.');
      setEditingId(data.id);
      setSlugTouched(true);
    }
    refresh();
  }

  function reset() { setForm(empty); setEditingId(null); setSlugTouched(false); }

  async function remove(row) {
    if (!confirm(`Delete "${row.title}"? Its gallery goes with it.`)) return;

    const { data: media } = await supabase.from('alie_collaboration_media').select('url').eq('collaboration_id', row.id);
    const { error } = await supabase.from('alie_collaborations').delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }

    for (const url of [row.hero_image_url, row.logo_url, ...(media || []).map((m) => m.url)].filter(Boolean)) {
      await removeIfUnreferenced(url);
    }
    if (editingId === row.id) reset();
    toast.success('Collaboration deleted.');
    refresh();
  }

  function edit(row) {
    setForm({
      title: row.title, slug: row.slug, partner_name: row.partner_name,
      story: row.story || '', status: row.status,
      hero_image_url: row.hero_image_url || '', logo_url: row.logo_url || '',
      launch_countdown_id: row.launch_countdown_id || '',
    });
    setEditingId(row.id);
    setSlugTouched(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="font-display text-3xl">Collaborations</h1>
        <span className="text-xs text-ink/40">{rows.length} total</span>
      </div>
      <p className="text-sm text-ink/50 mb-8">
        Published to /collaborations. Active ones appear first, then upcoming, then past.
      </p>

      <form onSubmit={handleSubmit} className="card-panel mb-10 grid md:grid-cols-2 gap-5">
        <div>
          <label className="field-label">Title</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) }))}
            required
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">Slug</label>
          <input
            value={form.slug}
            onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: slugify(e.target.value) }); }}
            required
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">Partner Name</label>
          <input value={form.partner_name} onChange={(e) => setForm({ ...form, partner_name: e.target.value })} required className="field-input" />
        </div>
        <div>
          <label className="field-label">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="field-input">
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="past">Past</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="field-label">Launch Countdown</label>
          <select
            value={form.launch_countdown_id}
            onChange={(e) => setForm({ ...form, launch_countdown_id: e.target.value })}
            className="field-input"
          >
            <option value="">None</option>
            {countdowns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <p className="text-[11px] text-ink/40 mt-1.5">Links this collaboration to a countdown for your own reference.</p>
        </div>

        <ImageField label="Hero Image" value={form.hero_image_url} onChange={(v) => setForm((f) => ({ ...f, hero_image_url: v }))} />
        <ImageField label="Partner Logo" value={form.logo_url} onChange={(v) => setForm((f) => ({ ...f, logo_url: v }))} aspect="aspect-square" />

        <div className="md:col-span-2">
          <label className="field-label">Story</label>
          <textarea value={form.story} onChange={(e) => setForm({ ...form, story: e.target.value })} rows={5} className="field-input" />
        </div>
        <div className="md:col-span-2 flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
          </button>
          {editingId && <button type="button" onClick={reset} className="btn-secondary">Done</button>}
        </div>
      </form>

      {editingId && (
        <div className="card-panel mb-10 pt-1">
          <GalleryPanel
            key={editingId}
            table="alie_collaboration_media"
            parentColumn="collaboration_id"
            parentId={editingId}
            title="Collaboration Gallery"
            description="Extra imagery shown alongside the story."
            extraColumns={{ type: 'image' }}
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-11" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">No collaborations yet — add your first one above.</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="table-head-row">
              <th className="py-3">Title</th><th>Partner</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`table-row ${editingId === r.id ? 'bg-camel/5' : ''}`}>
                <td className="py-3.5">{r.title}</td>
                <td className="text-ink/70">{r.partner_name}</td>
                <td className="capitalize">{r.status}</td>
                <td className="text-right space-x-4">
                  <button onClick={() => edit(r)} className="btn-link">Edit</button>
                  <button onClick={() => remove(r)} className="btn-link-danger">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
