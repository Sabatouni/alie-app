import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import ImageField from '../../components/admin/ImageField';
import { removeIfUnreferenced } from '../../lib/mediaUpload';

// alie_collections has been in the schema since 0001 and drives the storefront's
// /collections/:slug routes and the Products collection dropdown — but there was
// no admin screen, so collections could only be created with SQL.

const empty = {
  name: '', slug: '', description: '', banner_image_url: '', campaign_image_url: '',
  is_active: true, sort_order: 0,
};

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function CollectionsAdmin() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  async function refresh() {
    setLoading(true);
    const [{ data, error }, { data: products }] = await Promise.all([
      supabase.from('alie_collections').select('*').order('sort_order'),
      supabase.from('alie_products').select('collection_id'),
    ]);
    if (error) toast.error(error.message);
    setRows(data || []);
    setCounts((products || []).reduce((acc, p) => {
      if (p.collection_id) acc[p.collection_id] = (acc[p.collection_id] || 0) + 1;
      return acc;
    }, {}));
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, sort_order: Number(form.sort_order) || 0, description: form.description.trim() || null };
    const { error } = editingId
      ? await supabase.from('alie_collections').update(payload).eq('id', editingId)
      : await supabase.from('alie_collections').insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.code === '23505' ? 'That slug is already taken.' : error.message);
      return;
    }
    toast.success(editingId ? 'Collection updated.' : 'Collection created.');
    reset();
    refresh();
  }

  function reset() {
    setForm(empty);
    setEditingId(null);
    setSlugTouched(false);
  }

  async function remove(row) {
    const count = counts[row.id] || 0;
    const warning = count
      ? `"${row.name}" has ${count} ${count === 1 ? 'product' : 'products'}. They stay published but lose their collection. Continue?`
      : `Delete "${row.name}"?`;
    if (!confirm(warning)) return;

    const { error } = await supabase.from('alie_collections').delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }

    // The FK is ON DELETE SET NULL for products, so no product is lost — but the
    // collection's own images would be orphaned in the bucket.
    for (const url of [row.banner_image_url, row.campaign_image_url].filter(Boolean)) {
      await removeIfUnreferenced(url);
    }

    if (editingId === row.id) reset();
    toast.success('Collection deleted.');
    refresh();
  }

  function edit(row) {
    setForm({
      name: row.name, slug: row.slug, description: row.description || '',
      banner_image_url: row.banner_image_url || '', campaign_image_url: row.campaign_image_url || '',
      is_active: row.is_active, sort_order: row.sort_order ?? 0,
    });
    setEditingId(row.id);
    setSlugTouched(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const reordered = [...rows];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);

    // Renumber the whole list rather than swapping two values: swapping breaks
    // silently whenever two rows share a sort_order, which is the default state.
    setRows(reordered);
    const { error } = await supabase
      .from('alie_collections')
      .upsert(reordered.map((r, i) => ({ ...r, sort_order: i })), { onConflict: 'id' });
    if (error) { toast.error(error.message); }
    refresh();
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="font-display text-3xl">Collections</h1>
        <span className="text-xs text-ink/40">{rows.length} total</span>
      </div>
      <p className="text-sm text-ink/50 mb-8">
        Collections group products and give them a page at /collections/your-slug. Order here controls
        the order of the filter chips on the storefront.
      </p>

      <form onSubmit={handleSubmit} className="card-panel mb-10 grid md:grid-cols-2 gap-5">
        <div>
          <label className="field-label">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: slugTouched ? f.slug : slugify(e.target.value) }))}
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
        <div className="md:col-span-2">
          <label className="field-label">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="field-input"
          />
          <p className="text-[11px] text-ink/40 mt-1.5">Used as the headline on the collection page.</p>
        </div>

        <ImageField
          label="Banner Image"
          value={form.banner_image_url}
          onChange={(v) => setForm((f) => ({ ...f, banner_image_url: v }))}
        />
        <ImageField
          label="Campaign Image"
          value={form.campaign_image_url}
          onChange={(v) => setForm((f) => ({ ...f, campaign_image_url: v }))}
        />

        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />
          Active — visible on the storefront
        </label>

        <div className="md:col-span-2 flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : editingId ? 'Update Collection' : 'Create Collection'}
          </button>
          {editingId && <button type="button" onClick={reset} className="btn-secondary">Cancel</button>}
        </div>
      </form>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-11" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">No collections yet — create your first one above.</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="table-head-row">
              <th className="py-3">Order</th><th>Name</th><th>Slug</th><th>Products</th><th>Active</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="table-row">
                <td className="py-3.5 whitespace-nowrap">
                  <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="disabled:opacity-25 hover:text-camel px-1">↑</button>
                  <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down" className="disabled:opacity-25 hover:text-camel px-1">↓</button>
                </td>
                <td>{r.name}</td>
                <td className="text-ink/60 font-mono text-xs">{r.slug}</td>
                <td className="tabular-nums text-ink/70">{counts[r.id] || 0}</td>
                <td><span className={`badge-pill ${r.is_active ? 'bg-ink text-paper border-ink' : ''}`}>{r.is_active ? 'Active' : 'Hidden'}</span></td>
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
