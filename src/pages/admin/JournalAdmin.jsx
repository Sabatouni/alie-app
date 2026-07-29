import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import ImageField from '../../components/admin/ImageField';
import TaxonomyManager from '../../components/admin/TaxonomyManager';
import { removeIfUnreferenced } from '../../lib/mediaUpload';

const empty = {
  title: '', slug: '', excerpt: '', body: '', author: '', reading_time: '',
  status: 'draft', hero_image_url: '', featured: false, category_id: '',
};

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function JournalAdmin() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [postTags, setPostTags] = useState([]); // tag ids on the post being edited
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  async function refresh() {
    setLoading(true);
    const [{ data, error }, { data: cats }, { data: tagRows }] = await Promise.all([
      supabase.from('alie_journal_posts').select('*').order('created_at', { ascending: false }),
      supabase.from('alie_journal_categories').select('*').order('name'),
      supabase.from('alie_journal_tags').select('*').order('name'),
    ]);
    if (error) toast.error(error.message);
    setRows(data || []);
    setCategories(cats || []);
    setTags(tagRows || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    const existing = rows.find((r) => r.id === editingId);
    const payload = {
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt.trim() || null,
      body: form.body.trim() || null,
      author: form.author.trim() || null,
      hero_image_url: form.hero_image_url || null,
      category_id: form.category_id || null,
      featured: form.featured,
      status: form.status,
      reading_time: form.reading_time ? Number(form.reading_time) : null,
      // Stamp published_at once, on the transition to published. The old code
      // reset it to now() on every save, so editing a typo re-dated the article
      // and reshuffled the Journal index.
      published_at: form.status === 'published'
        ? (existing?.published_at || new Date().toISOString())
        : null,
    };

    const { data, error } = editingId
      ? await supabase.from('alie_journal_posts').update(payload).eq('id', editingId).select().single()
      : await supabase.from('alie_journal_posts').insert(payload).select().single();
    if (error) { setSaving(false); toast.error(error.code === '23505' ? 'That slug is already taken.' : error.message); return; }

    await syncTags(data.id, postTags);
    setSaving(false);

    if (editingId) {
      toast.success('Article updated.');
    } else {
      toast.success('Article saved.');
      setEditingId(data.id);
      setSlugTouched(true);
    }
    refresh();
  }

  // Replace the post's tag links with exactly the selected set.
  async function syncTags(postId, tagIds) {
    const { data: current } = await supabase.from('alie_journal_post_tags').select('tag_id').eq('post_id', postId);
    const have = new Set((current || []).map((r) => r.tag_id));
    const want = new Set(tagIds);

    const toAdd = [...want].filter((id) => !have.has(id));
    const toDrop = [...have].filter((id) => !want.has(id));

    if (toAdd.length) {
      await supabase.from('alie_journal_post_tags').insert(toAdd.map((tag_id) => ({ post_id: postId, tag_id })));
    }
    if (toDrop.length) {
      await supabase.from('alie_journal_post_tags').delete().eq('post_id', postId).in('tag_id', toDrop);
    }
  }

  function reset() { setForm(empty); setEditingId(null); setPostTags([]); setSlugTouched(false); }

  async function remove(row) {
    if (!confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('alie_journal_posts').delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    if (row.hero_image_url) await removeIfUnreferenced(row.hero_image_url);
    if (editingId === row.id) reset();
    toast.success('Article deleted.');
    refresh();
  }

  async function edit(row) {
    setForm({
      title: row.title, slug: row.slug, excerpt: row.excerpt || '', body: row.body || '',
      author: row.author || '', reading_time: row.reading_time || '', status: row.status,
      hero_image_url: row.hero_image_url || '', featured: row.featured,
      category_id: row.category_id || '',
    });
    setEditingId(row.id);
    setSlugTouched(true);
    const { data } = await supabase.from('alie_journal_post_tags').select('tag_id').eq('post_id', row.id);
    setPostTags((data || []).map((r) => r.tag_id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleTag(id) {
    setPostTags((current) => (current.includes(id) ? current.filter((t) => t !== id) : [...current, id]));
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="font-display text-3xl">Journal</h1>
        <span className="text-xs text-ink/40">{rows.length} total</span>
      </div>
      <p className="text-sm text-ink/50 mb-8">
        Published articles appear at /journal and each gets its own page at /journal/your-slug.
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
          <label className="field-label">Author</label>
          <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="field-input" />
        </div>
        <div>
          <label className="field-label">Reading Time (min)</label>
          <input
            type="number" min="1" step="1"
            value={form.reading_time}
            onChange={(e) => setForm({ ...form, reading_time: e.target.value })}
            className="field-input"
          />
        </div>
        <div>
          <label className="field-label">Category</label>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="field-input">
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="field-input">
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <ImageField
            label="Hero Image"
            value={form.hero_image_url}
            onChange={(v) => setForm((f) => ({ ...f, hero_image_url: v }))}
          />
        </div>

        <div className="md:col-span-2">
          <label className="field-label">Excerpt</label>
          <textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} className="field-input" />
        </div>
        <div className="md:col-span-2">
          <label className="field-label">Body</label>
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={10} className="field-input" />
          <p className="text-[11px] text-ink/40 mt-1.5">Plain text. Line breaks are preserved on the article page.</p>
        </div>

        {tags.length > 0 && (
          <div className="md:col-span-2">
            <label className="field-label">Tags</label>
            <div className="flex gap-2 flex-wrap">
              {tags.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  aria-pressed={postTags.includes(t.id)}
                  className={`badge-pill ${postTags.includes(t.id) ? 'bg-ink text-paper border-ink' : ''}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
          Featured
        </label>

        <div className="md:col-span-2 flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : editingId ? 'Update Article' : 'Save Article'}
          </button>
          {editingId && <button type="button" onClick={reset} className="btn-secondary">Done</button>}
        </div>
      </form>

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <TaxonomyManager
          table="alie_journal_categories"
          title="Categories"
          description="Shown as filter chips on the Journal index."
          onChange={refresh}
        />
        <TaxonomyManager
          table="alie_journal_tags"
          title="Tags"
          description="Listed at the foot of an article."
          onChange={refresh}
        />
      </div>

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
              <th className="py-3">Title</th><th>Category</th><th>Author</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`table-row ${editingId === r.id ? 'bg-camel/5' : ''}`}>
                <td className="py-3.5">{r.title}</td>
                <td className="text-ink/70">{categories.find((c) => c.id === r.category_id)?.name || '—'}</td>
                <td className="text-ink/70">{r.author || '—'}</td>
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
