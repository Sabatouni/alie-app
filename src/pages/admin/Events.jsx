import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import ImageField from '../../components/admin/ImageField';
import GalleryPanel from '../../components/admin/GalleryPanel';
import { removeIfUnreferenced } from '../../lib/mediaUpload';
import { toLocalInput } from '../../lib/datetime';

const empty = {
  title: '', slug: '', venue: '', event_date: '', status: 'upcoming',
  description: '', banner_image_url: '', registration_url: '',
};

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function Events() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.from('alie_events').select('*').order('event_date', { ascending: false });
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      event_date: form.event_date ? new Date(form.event_date).toISOString() : null,
      description: form.description.trim() || null,
      venue: form.venue.trim() || null,
      registration_url: form.registration_url.trim() || null,
      banner_image_url: form.banner_image_url || null,
    };
    const { data, error } = editingId
      ? await supabase.from('alie_events').update(payload).eq('id', editingId).select().single()
      : await supabase.from('alie_events').insert(payload).select().single();
    setSaving(false);
    if (error) { toast.error(error.code === '23505' ? 'That slug is already taken.' : error.message); return; }

    if (editingId) {
      toast.success('Event updated.');
    } else {
      // Stay on the new row so its gallery panel is immediately usable.
      toast.success('Event created — add gallery images below.');
      setEditingId(data.id);
      setSlugTouched(true);
    }
    refresh();
  }

  function reset() { setForm(empty); setEditingId(null); setSlugTouched(false); }

  async function remove(row) {
    if (!confirm(`Delete "${row.title}"? Its gallery images go with it.`)) return;

    const { data: gallery } = await supabase.from('alie_event_images').select('url').eq('event_id', row.id);
    const { error } = await supabase.from('alie_events').delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }

    for (const url of [row.banner_image_url, ...(gallery || []).map((g) => g.url)].filter(Boolean)) {
      await removeIfUnreferenced(url);
    }
    if (editingId === row.id) reset();
    toast.success('Event deleted.');
    refresh();
  }

  function edit(row) {
    setForm({
      title: row.title, slug: row.slug, venue: row.venue || '',
      event_date: toLocalInput(row.event_date), status: row.status,
      description: row.description || '', banner_image_url: row.banner_image_url || '',
      registration_url: row.registration_url || '',
    });
    setEditingId(row.id);
    setSlugTouched(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="font-display text-3xl">Events</h1>
        <span className="text-xs text-ink/40">{rows.length} total</span>
      </div>
      <p className="text-sm text-ink/50 mb-8">
        Events appear at /events. Upcoming ones show first; cancelled ones are hidden from the site entirely.
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
          <label className="field-label">Venue</label>
          <input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} className="field-input" />
        </div>
        <div>
          <label className="field-label">Date &amp; Time</label>
          <input
            type="datetime-local"
            value={form.event_date}
            onChange={(e) => setForm({ ...form, event_date: e.target.value })}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="field-input">
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="cancelled">Cancelled — hidden from the site</option>
          </select>
        </div>
        <div>
          <label className="field-label">Registration URL</label>
          <input
            type="url"
            value={form.registration_url}
            onChange={(e) => setForm({ ...form, registration_url: e.target.value })}
            placeholder="https://…"
            className="field-input"
          />
          <p className="text-[11px] text-ink/40 mt-1.5">Optional. Shows a Register button on upcoming events.</p>
        </div>
        <div className="md:col-span-2">
          <label className="field-label">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="field-input"
          />
        </div>
        <div className="md:col-span-2">
          <ImageField
            label="Banner Image"
            value={form.banner_image_url}
            onChange={(v) => setForm((f) => ({ ...f, banner_image_url: v }))}
          />
        </div>
        <div className="md:col-span-2 flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : editingId ? 'Update Event' : 'Create Event'}
          </button>
          {editingId && <button type="button" onClick={reset} className="btn-secondary">Done</button>}
        </div>
      </form>

      {editingId && (
        <div className="card-panel mb-10 pt-1">
          <GalleryPanel
            key={editingId}
            table="alie_event_images"
            parentColumn="event_id"
            parentId={editingId}
            title="Event Gallery"
            description="Extra photos shown beneath the banner on the Events page."
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-11" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">No events yet — create your first one above.</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="table-head-row">
              <th className="py-3">Title</th><th>Venue</th><th>Date</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`table-row ${editingId === r.id ? 'bg-camel/5' : ''}`}>
                <td className="py-3.5">{r.title}</td>
                <td className="text-ink/70">{r.venue || '—'}</td>
                <td className="text-ink/70">{r.event_date ? new Date(r.event_date).toLocaleDateString() : '—'}</td>
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
