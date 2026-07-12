import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

const empty = { title: '', slug: '', venue: '', event_date: '', status: 'upcoming', description: '', banner_image_url: '' };

export default function Events() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.from('alie_events').select('*').order('event_date', { ascending: true });
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, event_date: form.event_date ? new Date(form.event_date).toISOString() : null };
    const { error } = editingId
      ? await supabase.from('alie_events').update(payload).eq('id', editingId)
      : await supabase.from('alie_events').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? 'Event updated.' : 'Event created.');
    setForm(empty); setEditingId(null); refresh();
  }

  async function remove(id, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('alie_events').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Event deleted.');
    refresh();
  }

  function edit(row) {
    setForm({
      title: row.title, slug: row.slug, venue: row.venue || '',
      event_date: row.event_date?.slice(0, 16) || '', status: row.status,
      description: row.description || '', banner_image_url: row.banner_image_url || '',
    });
    setEditingId(row.id);
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-8">Events</h1>

      <form onSubmit={handleSubmit} className="card-panel mb-10 grid grid-cols-2 gap-5">
        <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
        <Field label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} required />
        <Field label="Venue" value={form.venue} onChange={(v) => setForm({ ...form, venue: v })} />
        <div>
          <label className="field-label">Date &amp; Time</label>
          <input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className="field-input" />
        </div>
        <div>
          <label className="field-label">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="field-input">
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <Field label="Banner Image URL" value={form.banner_image_url} onChange={(v) => setForm({ ...form, banner_image_url: v })} />
        <div className="col-span-2">
          <label className="field-label">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="field-input" />
        </div>
        <div className="col-span-2 flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : editingId ? 'Update Event' : 'Create Event'}
          </button>
          {editingId && <button type="button" onClick={() => { setForm(empty); setEditingId(null); }} className="btn-secondary">Cancel</button>}
        </div>
      </form>

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
              <tr key={r.id} className="table-row">
                <td className="py-3.5">{r.title}</td><td className="text-ink/70">{r.venue}</td>
                <td className="text-ink/70">{r.event_date ? new Date(r.event_date).toLocaleDateString() : '—'}</td>
                <td className="capitalize">{r.status}</td>
                <td className="text-right space-x-4">
                  <button onClick={() => edit(r)} className="btn-link">Edit</button>
                  <button onClick={() => remove(r.id, r.title)} className="btn-link-danger">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Field({ label, value, onChange, required }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required} className="field-input" />
    </div>
  );
}
