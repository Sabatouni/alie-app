import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import ProductImagesPanel from '../../components/admin/ProductImagesPanel';
import ProductVariantsPanel from '../../components/admin/ProductVariantsPanel';
import { removeIfUnreferenced } from '../../lib/mediaUpload';
import { formatMoney } from '../../lib/currency';

// Every column on alie_products is editable here. Before this pass the form
// covered eight of them, so description, story, care instructions, collection
// assignment, the New/Limited/Featured flags, stock and SKU could only be set
// with hand-written SQL.

const empty = {
  name: '', slug: '', category: '', collection_id: '', price: '', compare_at_price: '',
  fabric: '', care_instructions: '', description: '', story: '', sku: '', stock_count: '',
  status: 'draft', is_new: false, is_limited: false, is_featured: false,
  seo_title: '', seo_description: '',
};

const STATUS_STYLE = {
  published: 'bg-ink text-paper border-ink',
  draft: 'border-ink/20 text-ink/60',
  archived: 'border-ink/10 text-ink/30',
};

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Form state → the shape alie_products actually wants (numbers, nulls, no ''). */
function toPayload(form) {
  return {
    name: form.name.trim(),
    slug: form.slug,
    category: form.category.trim(),
    collection_id: form.collection_id || null,
    price: Number(form.price),
    compare_at_price: form.compare_at_price === '' ? null : Number(form.compare_at_price),
    fabric: form.fabric.trim() || null,
    care_instructions: form.care_instructions.trim() || null,
    description: form.description.trim() || null,
    story: form.story.trim() || null,
    sku: form.sku.trim() || null,
    stock_count: form.stock_count === '' ? 0 : Number(form.stock_count),
    status: form.status,
    is_new: form.is_new,
    is_limited: form.is_limited,
    is_featured: form.is_featured,
    seo_title: form.seo_title.trim() || null,
    seo_description: form.seo_description.trim() || null,
    updated_at: new Date().toISOString(),
  };
}

function toForm(p) {
  return {
    name: p.name || '', slug: p.slug || '', category: p.category || '',
    collection_id: p.collection_id || '', price: p.price ?? '',
    compare_at_price: p.compare_at_price ?? '', fabric: p.fabric || '',
    care_instructions: p.care_instructions || '', description: p.description || '',
    story: p.story || '', sku: p.sku || '', stock_count: p.stock_count ?? '',
    status: p.status || 'draft', is_new: !!p.is_new, is_limited: !!p.is_limited,
    is_featured: !!p.is_featured, seo_title: p.seo_title || '', seo_description: p.seo_description || '',
  };
}

export default function AdminProducts() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [slugTouched, setSlugTouched] = useState(false);

  async function refresh() {
    setLoading(true);
    const [{ data, error }, { data: cols }] = await Promise.all([
      supabase.from('alie_products').select('*').order('created_at', { ascending: false }),
      supabase.from('alie_collections').select('id, name').order('sort_order'),
    ]);
    if (error) toast.error(error.message);
    setProducts(data || []);
    setCollections(cols || []);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => statusFilter === 'all' || p.status === statusFilter)
      .filter((p) => collectionFilter === 'all'
        || (collectionFilter === 'none' ? !p.collection_id : p.collection_id === collectionFilter))
      .filter((p) => !q
        || p.name?.toLowerCase().includes(q)
        || p.category?.toLowerCase().includes(q)
        || p.sku?.toLowerCase().includes(q)
        || p.slug?.toLowerCase().includes(q));
  }, [products, search, statusFilter, collectionFilter]);

  const editingProduct = products.find((p) => p.id === editingId);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!(Number(form.price) > 0)) {
      toast.error('Price must be greater than zero.');
      return;
    }
    if (form.compare_at_price !== '' && Number(form.compare_at_price) <= Number(form.price)) {
      toast.error('Compare-at price should be higher than the selling price, or left blank.');
      return;
    }

    setSaving(true);
    const payload = toPayload(form);
    const wasEditing = Boolean(editingId);
    const { data, error } = wasEditing
      ? await supabase.from('alie_products').update(payload).eq('id', editingId).select().single()
      : await supabase.from('alie_products').insert(payload).select().single();
    setSaving(false);

    if (error) {
      toast.error(error.code === '23505' ? 'That slug or SKU is already taken.' : error.message);
      return;
    }

    if (wasEditing) {
      toast.success('Product updated.');
    } else {
      // Stay on the new product so its Images and Variants panels are usable
      // straight away — hunting for it in the table afterwards was the slow part.
      toast.success('Product created — add images and colours below.');
      setEditingId(data.id);
      setSlugTouched(true);
    }
    refresh();
  }

  function resetForm() {
    setForm(empty);
    setEditingId(null);
    setSlugTouched(false);
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"? Its images and variants go with it. This cannot be undone.`)) return;

    // Collect image URLs before the FK cascade removes the rows, so the files
    // don't linger in the bucket as orphans.
    const { data: productImages } = await supabase
      .from('alie_product_images')
      .select('url')
      .eq('product_id', id);

    const { error } = await supabase.from('alie_products').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }

    // Sequential on purpose: each call checks whether the URL is still
    // referenced, and a shared file must survive if any other row uses it.
    for (const image of productImages || []) {
      await removeIfUnreferenced(image.url);
    }

    if (editingId === id) resetForm();
    toast.success('Product deleted.');
    refresh();
  }

  function handleEdit(p) {
    setForm(toForm(p));
    setEditingId(p.id);
    setSlugTouched(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleNameChange(v) {
    setForm((f) => ({ ...f, name: v, slug: slugTouched ? f.slug : slugify(v) }));
  }

  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="font-display text-3xl">Products</h1>
        <span className="text-xs text-ink/40">{products.length} total</span>
      </div>
      <p className="text-sm text-ink/50 mb-8">
        Create or edit a product, then manage its photography and colours in the panels below.
      </p>

      <form onSubmit={handleSubmit} className="card-panel mb-10 space-y-7">
        <fieldset>
          <legend className="text-[11px] tracking-[0.14em] uppercase text-ink/50 mb-4">Basics</legend>
          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Name" value={form.name} onChange={handleNameChange} required />
            <Field
              label="Slug"
              value={form.slug}
              onChange={(v) => { setSlugTouched(true); set('slug')(slugify(v)); }}
              hint="Used in the product URL: /product/your-slug"
              required
            />
            <Field label="Category" value={form.category} onChange={set('category')} required />
            <div>
              <label className="field-label">Collection</label>
              <select value={form.collection_id} onChange={(e) => set('collection_id')(e.target.value)} className="field-input">
                <option value="">No collection</option>
                {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Field label="Price (TZS)" type="number" min="1" step="1" value={form.price} onChange={set('price')} required />
            <Field
              label="Compare-at Price (TZS)"
              type="number" min="0" step="1"
              value={form.compare_at_price}
              onChange={set('compare_at_price')}
              hint="Optional. The struck-through 'was' price."
            />
            <Field label="SKU" value={form.sku} onChange={set('sku')} hint="Optional. Must be unique across products." />
            <Field label="Stock Count" type="number" min="0" step="1" value={form.stock_count} onChange={set('stock_count')} />
          </div>
        </fieldset>

        <fieldset className="border-t border-ink/10 pt-6">
          <legend className="text-[11px] tracking-[0.14em] uppercase text-ink/50 mb-4">Copy</legend>
          <div className="grid gap-5">
            <TextArea label="Description" value={form.description} onChange={set('description')} rows={3} />
            <TextArea label="Story" value={form.story} onChange={set('story')} rows={3} hint="Shown under the product name on the detail page." />
            <div className="grid md:grid-cols-2 gap-5">
              <TextArea label="Fabric / Materials" value={form.fabric} onChange={set('fabric')} rows={2} />
              <TextArea label="Care Instructions" value={form.care_instructions} onChange={set('care_instructions')} rows={2} />
            </div>
          </div>
        </fieldset>

        <fieldset className="border-t border-ink/10 pt-6">
          <legend className="text-[11px] tracking-[0.14em] uppercase text-ink/50 mb-4">Visibility</legend>
          <div className="grid md:grid-cols-2 gap-5 items-start">
            <div>
              <label className="field-label">Status</label>
              <select value={form.status} onChange={(e) => set('status')(e.target.value)} className="field-input">
                <option value="draft">Draft — hidden from the site</option>
                <option value="published">Published — live</option>
                <option value="archived">Archived — hidden, kept for records</option>
              </select>
            </div>
            <div className="flex flex-col gap-2.5 pt-7">
              <Check label="New — shows the New badge" checked={form.is_new} onChange={set('is_new')} />
              <Check label="Limited — shows the Limited badge" checked={form.is_limited} onChange={set('is_limited')} />
              <Check label="Featured — appears in the homepage featured row" checked={form.is_featured} onChange={set('is_featured')} />
            </div>
          </div>
        </fieldset>

        <fieldset className="border-t border-ink/10 pt-6">
          <legend className="text-[11px] tracking-[0.14em] uppercase text-ink/50 mb-4">Search Engines</legend>
          <div className="grid gap-5">
            <Field label="SEO Title" value={form.seo_title} onChange={set('seo_title')} hint="Falls back to the product name." />
            <TextArea label="SEO Description" value={form.seo_description} onChange={set('seo_description')} rows={2} hint="Falls back to the description." />
          </div>
        </fieldset>

        <div className="flex gap-3 border-t border-ink/10 pt-6">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : editingId ? 'Update Product' : 'Create Product'}
          </button>
          {editingId && <button type="button" onClick={resetForm} className="btn-secondary">Done</button>}
        </div>
      </form>

      {editingId ? (
        <>
          <ProductImagesPanel key={`img-${editingId}`} productId={editingId} productName={form.name} />
          <ProductVariantsPanel key={`var-${editingId}`} productId={editingId} productSku={editingProduct?.sku} />
        </>
      ) : (
        <p className="text-sm text-ink/45 mb-10 border border-dashed border-ink/15 px-4 py-3.5">
          Images, colours and sizes are managed per product — create a product above, or press Edit on
          one below, to manage them here.
        </p>
      )}

      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <input
          type="search"
          placeholder="Search name, category, slug or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
          className="field-input max-w-xs"
        />
        <select
          value={collectionFilter}
          onChange={(e) => setCollectionFilter(e.target.value)}
          aria-label="Filter by collection"
          className="field-input max-w-[14rem]"
        >
          <option value="all">All collections</option>
          <option value="none">No collection</option>
          {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-2">
          {['all', 'draft', 'published', 'archived'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              aria-pressed={statusFilter === s}
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
              <th className="py-3">Name</th><th>Category</th><th>Collection</th><th>Price</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className={`table-row ${editingId === p.id ? 'bg-camel/5' : ''}`}>
                <td className="py-3.5">
                  {p.name}
                  {p.is_featured && <span className="ml-2 text-[9px] tracking-[0.12em] uppercase text-camel">Featured</span>}
                </td>
                <td className="text-ink/70">{p.category}</td>
                <td className="text-ink/70">{collections.find((c) => c.id === p.collection_id)?.name || '—'}</td>
                <td className="tabular-nums">{formatMoney(p.price, p.currency)}</td>
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

function Field({ label, value, onChange, type = 'text', required, hint, ...rest }) {
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
      {hint && <p className="text-[11px] text-ink/40 mt-1.5">{hint}</p>}
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3, hint }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="field-input" />
      {hint && <p className="text-[11px] text-ink/40 mt-1.5">{hint}</p>}
    </div>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-ink/75 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
