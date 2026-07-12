import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

const empty = { title: '', slug: '', excerpt: '', body: '', author: '', reading_time: '', status: 'draft', hero_image_url: '', featured: false };

export default function JournalAdmin() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.from('alie_journal_posts').select('*').order('created_at', { ascending: false });
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
      reading_time: form.reading_time ? Number(form.reading_time) : null,
      published_at: form.status === 'published' ? new Date().toISOString() : null,
    };
    const { error } = editingId
      ? await supabase.from('alie_journal_posts').update(payload).eq('id', editingId)
      : await supabase.from('alie_journal_posts').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? 'Article updated.' : 'Article saved.');
    setForm(empty); setEditingId(null); refresh();
  }

  async function remove(id, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('alie_journal_posts').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Article deleted.');
    refresh();
  }

  function edit(row) {
    setForm({
      title: row.title, slug: row.slug, excerpt: row.excerpt || '', body: row.body || '',
      author: row.author || '', reading_time: row.reading_time || '', status: row.status,
      hero_image_url: row.hero_image_url || '', featured: row.featured,
    });
    setEditingId(row.id);
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-8">Journal</h1>

      <form onSubmit={handleSubmit} className="card-panel mb-10 grid grid-cols-2 gap-5">
        <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
        <Field label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} required />
        <Field label="Author" value={form.author} onChange={(v) => setForm({ ...form, author: v })} />
        <Field label="Reading Time (min)" value={form.reading_time} onChange={(v) => setForm({ ...form, reading_time: v })} />
        <Field label="Hero Image URL" value={form.hero_image_url} onChange={(v) => setForm({ ...form, hero_image_url: v })} />
        <div>
          <label className="field-label">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="field-input">
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="field-label">Excerpt</label>
          <textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} className="field-input" />
        </div>
        <div className="col-span-2">
          <label className="field-label">Body</label>
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={6} className="field-input" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
          Featured
        </label>
        <div className="col-span-2 flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : editingId ? 'Update Article' : 'Publish Article'}
          </button>
          {editingId && <button type="button" onClick={() => { setForm(empty); setEditingId(null); }} className="btn-secondary">Cancel</button>}
        </div>
      </form>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-11" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">No articles yet — write your first one above.</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="table-head-row">
              <th className="py-3">Title</th><th>Author</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="py-3.5">{r.title}</td><td className="text-ink/70">{r.author}</td>
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
