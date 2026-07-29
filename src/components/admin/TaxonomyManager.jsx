import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

// alie_journal_categories and alie_journal_tags are both {id, name, slug} and
// both had zero admin UI — the Journal page's category join has always returned
// null because nothing could populate the table.

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function TaxonomyManager({ table, title, description, onChange }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from(table).select('*').order('name');
    if (error) toast?.error(error.message);
    setRows(data || []);
    setLoading(false);
  }, [table, toast]);

  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    const value = name.trim();
    if (!value) return;

    setSaving(true);
    const { data, error } = await supabase.from(table).insert({ name: value, slug: slugify(value) }).select().single();
    setSaving(false);
    if (error) {
      toast?.error(error.code === '23505' ? `"${value}" already exists.` : error.message);
      return;
    }
    setRows((list) => [...list, data].sort((a, b) => a.name.localeCompare(b.name)));
    setName('');
    onChange?.();
  }

  async function rename(row, next) {
    const value = next.trim();
    if (!value || value === row.name) return;
    const { error } = await supabase.from(table).update({ name: value, slug: slugify(value) }).eq('id', row.id);
    if (error) { toast?.error(error.message); load(); return; }
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, name: value, slug: slugify(value) } : r)));
    onChange?.();
  }

  async function remove(row) {
    // Posts keep existing either way: category_id is ON DELETE SET NULL and the
    // tag join table is ON DELETE CASCADE.
    if (!confirm(`Delete "${row.name}"? Articles using it stay published.`)) return;
    const { error } = await supabase.from(table).delete().eq('id', row.id);
    if (error) { toast?.error(error.message); return; }
    setRows((list) => list.filter((r) => r.id !== row.id));
    onChange?.();
  }

  return (
    <section className="card-panel">
      <h2 className="font-display text-xl mb-1">{title}</h2>
      {description && <p className="text-xs text-ink/45 mb-4">{description}</p>}

      <form onSubmit={add} className="flex gap-2 mb-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`New ${title.toLowerCase().replace(/s$/, '')}…`}
          aria-label={`New ${title}`}
          className="field-input flex-1"
        />
        <button type="submit" disabled={saving || !name.trim()} className="btn-secondary whitespace-nowrap">Add</button>
      </form>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-8" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink/45">None yet.</p>
      ) : (
        <ul className="divide-y divide-ink/5">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-2">
              <input
                defaultValue={row.name}
                onBlur={(e) => rename(row, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                aria-label={`Rename ${row.name}`}
                className="field-input py-1.5 text-sm flex-1"
              />
              <button type="button" onClick={() => remove(row)} className="btn-link-danger">Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
