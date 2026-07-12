import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

const LOCATIONS = ['homepage_hero', 'homepage_below_arrivals', 'collection_page', 'product_page', 'event_page'];
const empty = { title: '', target_at: '', location_key: LOCATIONS[0], completion_message: 'Now Available', banner_image_url: '', is_enabled: true };

export default function Countdowns() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.from('alie_countdowns').select('*').order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, target_at: new Date(form.target_at).toISOString() };
    const { error } = editingId
      ? await supabase.from('alie_countdowns').update(payload).eq('id', editingId)
      : await supabase.from('alie_countdowns').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? 'Countdown updated.' : 'Countdown created.');
    setForm(empty);
    setEditingId(null);
    refresh();
  }

  async function toggleEnabled(row) {
    await supabase.from('alie_countdowns').update({ is_enabled: !row.is_enabled }).eq('id', row.id);
    refresh();
  }

  async function duplicate(row) {
    const { id: _id, created_at: _createdAt, ...rest } = row;
    await supabase.from('alie_countdowns').insert({ ...rest, title: `${rest.title} (Copy)`, is_enabled: false });
    refresh();
  }

  async function remove(id, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('alie_countdowns').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Countdown deleted.');
    refresh();
  }

  function edit(row) {
    setForm({
      title: row.title,
      target_at: row.target_at?.slice(0, 16) || '',
      location_key: row.location_key || LOCATIONS[0],
      completion_message: row.completion_message || 'Now Available',
      banner_image_url: row.banner_image_url || '',
      is_enabled: row.is_enabled,
    });
    setEditingId(row.id);
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-8">Countdowns</h1>
      <p className="text-sm text-ink/50 max-w-lg mb-8">
        Only enabled countdowns appear on the site, and only at the location you assign. Nothing shows by default.
      </p>

      <form onSubmit={handleSubmit} className="card-panel mb-10 grid grid-cols-2 gap-5">
        <div>
          <label className="field-label">Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="field-input" />
        </div>
        <div>
          <label className="field-label">Target Date &amp; Time</label>
          <input type="datetime-local" value={form.target_at} onChange={(e) => setForm({ ...form, target_at: e.target.value })} required className="field-input" />
        </div>
        <div>
          <label className="field-label">Appears On</label>
          <select value={form.location_key} onChange={(e) => setForm({ ...form, location_key: e.target.value })} className="field-input">
            {LOCATIONS.map((l) => <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Completion Message</label>
          <input value={form.completion_message} onChange={(e) => setForm({ ...form, completion_message: e.target.value })} className="field-input" />
        </div>
        <div className="col-span-2">
          <label className="field-label">Banner Image URL (copy from Media Library)</label>
          <input value={form.banner_image_url} onChange={(e) => setForm({ ...form, banner_image_url: e.target.value })} className="field-input" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} />
          Enabled
        </label>
        <div className="col-span-2 flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : editingId ? 'Update Countdown' : 'Create Countdown'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setForm(empty); setEditingId(null); }} className="btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-11" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">No countdowns yet — create one above. Nothing appears on the site until it's enabled.</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="table-head-row">
              <th className="py-3">Title</th><th>Location</th><th>Target</th><th>Enabled</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="py-3.5">{r.title}</td>
                <td className="capitalize text-ink/70">{r.location_key?.replace(/_/g, ' ')}</td>
                <td className="text-ink/70">{new Date(r.target_at).toLocaleString()}</td>
                <td>
                  <button onClick={() => toggleEnabled(r)} className={`badge-pill ${r.is_enabled ? 'bg-ink text-paper border-ink' : ''}`}>
                    {r.is_enabled ? 'On' : 'Off'}
                  </button>
                </td>
                <td className="text-right space-x-4">
                  <button onClick={() => edit(r)} className="btn-link">Edit</button>
                  <button onClick={() => duplicate(r)} className="btn-link">Duplicate</button>
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
