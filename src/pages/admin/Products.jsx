import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

const empty = { name: '', slug: '', category: '', price: '', fabric: '', status: 'draft', seo_title: '', seo_description: '' };

const STATUS_STYLE = {
  published: 'bg-ink text-paper border-ink',
  draft: 'border-ink/20 text-ink/60',
  archived: 'border-ink/10 text-ink/30',
};

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function AdminProducts() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [slugTouched, setSlugTouched] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.from('alie_products').select('*').order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setProducts(data || []);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return products
      .filter((p) => statusFilter === 'all' || p.status === statusFilter)
      .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase()));
  }, [products, search, statusFilter]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (Number(form.price) <= 0) {
      toast.error('Price must be greater than zero.');
      return;
    }
    setSaving(true);
    const payload = { ...form, price: Number(form.price) };
    const { error } = editingId
      ? await supabase.from('alie_products').update(payload).eq('id', editingId)
      : await supabase.from('alie_products').insert(payload);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingId ? 'Product updated.' : 'Product created.');
    setForm(empty);
    setEditingId(null);
    setSlugTouched(false);
    refresh();
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('alie_products').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Product deleted.');
    refresh();
  }

  function handleEdit(p) {
    setForm({ name: p.name, slug: p.slug, category: p.category, price: p.price, fabric: p.fabric || '', status: p.status, seo_title: p.seo_title || '', seo_description: p.seo_description || '' });
    setEditingId(p.id);
    setSlugTouched(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleNameChange(v) {
    setForm((f) => ({ ...f, name: v, slug: slugTouched ? f.slug : slugify(v) }));
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="font-display text-3xl">Products</h1>
        <span className="text-xs text-ink/40">{products.length} total</span>
      </div>
      <p className="text-sm text-ink/50 mb-8">Colours, sizes, and images are managed per-product after creation via alie_product_variants and alie_product_images.</p>

      <form onSubmit={handleSubmit} className="card-panel mb-10 grid grid-cols-2 gap-5">
        <Field label="Name" value={form.name} onChange={handleNameChange} required />
        <Field label="Slug" value={form.slug} onChange={(v) => { setSlugTouched(true); setForm({ ...form, slug: slugify(v) }); }} required />
        <Field label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} required />
        <Field label="Price (USD)" type="number" min="0.01" step="0.01" value={form.price} onChange={(v) => setForm({ ...form, price: v })} required />
        <Field label="Fabric" value={form.fabric} onChange={(v) => setForm({ ...form, fabric: v })} />
        <div>
          <label className="field-label">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="field-input">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <Field label="SEO Title" value={form.seo_title} onChange={(v) => setForm({ ...form, seo_title: v })} />
        <Field label="SEO Description" value={form.seo_description} onChange={(v) => setForm({ ...form, seo_description: v })} />
        <div className="col-span-2 flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : editingId ? 'Update Product' : 'Create Product'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setForm(empty); setEditingId(null); setSlugTouched(false); }} className="btn-secondary">
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <input
          type="search"
          placeholder="Search by name or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field-input max-w-xs"
        />
        <div className="flex gap-2">
          {['all', 'draft', 'published', 'archived'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`badge-pill capitalize ${statusFilter === s ? 'bg-ink text-paper border-ink' : ''}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-11" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {products.length === 0 ? 'No products yet — create your first one above.' : 'No products match this search or filter.'}
        </div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="table-head-row">
              <th className="py-3">Name</th><th>Category</th><th>Price</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="table-row">
                <td className="py-3.5">{p.name}</td>
                <td className="text-ink/70">{p.category}</td>
                <td className="tabular-nums">${p.price}</td>
                <td><span className={`badge-pill ${STATUS_STYLE[p.status]}`}>{p.status}</span></td>
                <td className="text-right space-x-4">
                  <button onClick={() => handleEdit(p)} className="btn-link">Edit</button>
                  <button onClick={() => handleDelete(p.id, p.name)} className="btn-link-danger">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, ...rest }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="field-input"
        {...rest}
      />
    </div>
  );
}
