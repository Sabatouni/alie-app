import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

const empty = { title: '', slug: '', partner_name: '', story: '', status: 'upcoming', hero_image_url: '', logo_url: '' };

export default function Collaborations() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.from('alie_collaborations').select('*').order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = editingId
      ? await supabase.from('alie_collaborations').update(form).eq('id', editingId)
      : await supabase.from('alie_collaborations').insert(form);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? 'Collaboration updated.' : 'Collaboration created.');
    setForm(empty); setEditingId(null); refresh();
  }

  async function remove(id, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('alie_collaborations').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Collaboration deleted.');
    refresh();
  }

  function edit(row) {
    setForm({
      title: row.title, slug: row.slug, partner_name: row.partner_name,
      story: row.story || '', status: row.status,
      hero_image_url: row.hero_image_url || '', logo_url: row.logo_url || '',
    });
    setEditingId(row.id);
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-8">Collaborations</h1>

      <form onSubmit={handleSubmit} className="card-panel mb-10 grid grid-cols-2 gap-5">
        <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
        <Field label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} required />
        <Field label="Partner Name" value={form.partner_name} onChange={(v) => setForm({ ...form, partner_name: v })} required />
        <div>
          <label className="field-label">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="field-input">
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="past">Past</option>
          </select>
        </div>
        <Field label="Hero Image URL" value={form.hero_image_url} onChange={(v) => setForm({ ...form, hero_image_url: v })} />
        <Field label="Logo URL" value={form.logo_url} onChange={(v) => setForm({ ...form, logo_url: v })} />
        <div className="col-span-2">
          <label className="field-label">Story</label>
          <textarea value={form.story} onChange={(e) => setForm({ ...form, story: e.target.value })} rows={4} className="field-input" />
        </div>
        <div className="col-span-2 flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
          </button>
          {editingId && <button type="button" onClick={() => { setForm(empty); setEditingId(null); }} className="btn-secondary">Cancel</button>}
        </div>
      </form>

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
              <tr key={r.id} className="table-row">
                <td className="py-3.5">{r.title}</td><td className="text-ink/70">{r.partner_name}</td>
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
