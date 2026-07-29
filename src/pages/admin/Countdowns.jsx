import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import ImageField from '../../components/admin/ImageField';
import { removeIfUnreferenced } from '../../lib/mediaUpload';
import { toLocalInput } from '../../lib/datetime';

// Countdowns carry product_id / collection_id / event_id / collaboration_id
// columns (migration 0002) that decide where the "Now Available" button goes.
// There was no UI for any of them, so the button could only ever be a dead end.

const LOCATIONS = [
  ['homepage_hero', 'Homepage — under the hero'],
  ['homepage_below_arrivals', 'Homepage — below the product grid'],
  ['collection_page', 'Collection pages'],
  ['product_page', 'Product pages'],
  ['event_page', 'Events page'],
];

// Each kind maps to one FK column on alie_countdowns. Products and collections
// have their own public routes; events and collaborations link to their index.
const TARGET_KINDS = [
  ['', 'No link — show the message as plain text'],
  ['product_id', 'A product'],
  ['collection_id', 'A collection'],
  ['event_id', 'An event (opens the Events page)'],
  ['collaboration_id', 'A collaboration (opens the Collaborations page)'],
];

const PICKER_LABEL = {
  product_id: 'Product',
  collection_id: 'Collection',
  event_id: 'Event',
  collaboration_id: 'Collaboration',
};

const empty = {
  title: '', target_at: '', location_key: LOCATIONS[0][0],
  completion_message: 'Now Available', banner_image_url: '', is_enabled: true,
  target_kind: '', target_id: '',
};

export default function Countdowns() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [events, setEvents] = useState([]);
  const [collaborations, setCollaborations] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    const [{ data, error }, { data: prods }, { data: cols }, { data: evts }, { data: collabs }] = await Promise.all([
      supabase.from('alie_countdowns').select('*').order('created_at', { ascending: false }),
      supabase.from('alie_products').select('id, name').order('name'),
      supabase.from('alie_collections').select('id, name').order('sort_order'),
      supabase.from('alie_events').select('id, title').order('event_date', { ascending: false }),
      supabase.from('alie_collaborations').select('id, title').order('created_at', { ascending: false }),
    ]);
    if (error) toast.error(error.message);
    setRows(data || []);
    setProducts(prods || []);
    setCollections(cols || []);
    // Normalise to {id, name} so one picker handles all four target kinds.
    setEvents((evts || []).map((e) => ({ id: e.id, name: e.title })));
    setCollaborations((collabs || []).map((c) => ({ id: c.id, name: c.title })));
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** The form's single target picker → the four mutually exclusive FK columns.
   *  Every kind other than "none" clears the other three, so a countdown can
   *  never carry two conflicting targets. */
  function targetColumns() {
    const base = { product_id: null, collection_id: null, event_id: null, collaboration_id: null };
    if (!form.target_kind || !form.target_id) return base;
    return { ...base, [form.target_kind]: form.target_id };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.target_kind && !form.target_id) {
      toast.error(`Choose which ${PICKER_LABEL[form.target_kind].toLowerCase()} the button links to.`);
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title,
      target_at: new Date(form.target_at).toISOString(),
      location_key: form.location_key,
      completion_message: form.completion_message,
      banner_image_url: form.banner_image_url || null,
      is_enabled: form.is_enabled,
      ...targetColumns(),
    };
    const { error } = editingId
      ? await supabase.from('alie_countdowns').update(payload).eq('id', editingId)
      : await supabase.from('alie_countdowns').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? 'Countdown updated.' : 'Countdown created.');
    reset();
    refresh();
  }

  function reset() {
    setForm(empty);
    setEditingId(null);
  }

  async function toggleEnabled(row) {
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, is_enabled: !r.is_enabled } : r)));
    const { error } = await supabase.from('alie_countdowns').update({ is_enabled: !row.is_enabled }).eq('id', row.id);
    if (error) { toast.error(error.message); refresh(); }
  }

  async function duplicate(row) {
    const { id: _id, created_at: _createdAt, ...rest } = row;
    const { error } = await supabase
      .from('alie_countdowns')
      .insert({ ...rest, title: `${rest.title} (Copy)`, is_enabled: false });
    if (error) { toast.error(error.message); return; }
    toast.success('Duplicated — the copy starts disabled.');
    refresh();
  }

  async function remove(row) {
    if (!confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('alie_countdowns').delete().eq('id', row.id);
    if (error) { toast.error(error.message); return; }
    if (row.banner_image_url) await removeIfUnreferenced(row.banner_image_url);
    if (editingId === row.id) reset();
    toast.success('Countdown deleted.');
    refresh();
  }

  function edit(row) {
    const kind = row.product_id ? 'product_id'
      : row.collection_id ? 'collection_id'
      : row.event_id ? 'event_id'
      : row.collaboration_id ? 'collaboration_id' : '';
    setForm({
      title: row.title,
      // datetime-local wants local wall-clock, and target_at is a UTC ISO string.
      target_at: toLocalInput(row.target_at),
      location_key: row.location_key || LOCATIONS[0][0],
      completion_message: row.completion_message || 'Now Available',
      banner_image_url: row.banner_image_url || '',
      is_enabled: row.is_enabled,
      target_kind: kind,
      target_id: kind ? row[kind] || '' : '',
    });
    setEditingId(row.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const pickerOptions = {
    product_id: products,
    collection_id: collections,
    event_id: events,
    collaboration_id: collaborations,
  }[form.target_kind] || [];

  return (
    <div>
      <h1 className="font-display text-3xl mb-3">Countdowns</h1>
      <p className="text-sm text-ink/50 max-w-xl mb-8">
        Only enabled countdowns appear, and only at the location you assign. A disabled countdown
        renders nothing at all — no block, no spacing.
      </p>

      <form onSubmit={handleSubmit} className="card-panel mb-10 grid md:grid-cols-2 gap-5">
        <div>
          <label className="field-label">Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="field-input" />
        </div>
        <div>
          <label className="field-label">Target Date &amp; Time</label>
          <input
            type="datetime-local"
            value={form.target_at}
            onChange={(e) => setForm({ ...form, target_at: e.target.value })}
            required
            className="field-input"
          />
          <p className="text-[11px] text-ink/40 mt-1.5">Your device's timezone.</p>
        </div>

        <div>
          <label className="field-label">Appears On</label>
          <select value={form.location_key} onChange={(e) => setForm({ ...form, location_key: e.target.value })} className="field-input">
            {LOCATIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Completion Message</label>
          <input
            value={form.completion_message}
            onChange={(e) => setForm({ ...form, completion_message: e.target.value })}
            className="field-input"
          />
        </div>

        <div>
          <label className="field-label">When It Finishes, Link To</label>
          <select
            value={form.target_kind}
            onChange={(e) => setForm({ ...form, target_kind: e.target.value, target_id: '' })}
            className="field-input"
          >
            {TARGET_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          {form.target_kind ? (
            <>
              <label className="field-label">{PICKER_LABEL[form.target_kind]}</label>
              <select
                value={form.target_id}
                onChange={(e) => setForm({ ...form, target_id: e.target.value })}
                className="field-input"
              >
                <option value="">Choose…</option>
                {pickerOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </>
          ) : (
            <p className="text-[11px] text-ink/40 pt-8">The message shows as text, not a button.</p>
          )}
        </div>

        <div className="md:col-span-2">
          <ImageField
            label="Banner Image"
            value={form.banner_image_url}
            onChange={(v) => setForm((f) => ({ ...f, banner_image_url: v }))}
            hint="Optional. Sits behind the countdown at 25% opacity."
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} />
          Enabled
        </label>

        <div className="md:col-span-2 flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : editingId ? 'Update Countdown' : 'Create Countdown'}
          </button>
          {editingId && <button type="button" onClick={reset} className="btn-secondary">Cancel</button>}
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
              <th className="py-3">Title</th><th>Location</th><th>Target</th><th>Links To</th><th>Enabled</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="py-3.5">{r.title}</td>
                <td className="text-ink/70">{LOCATIONS.find(([v]) => v === r.location_key)?.[1] || r.location_key}</td>
                <td className="text-ink/70">{new Date(r.target_at).toLocaleString()}</td>
                <td className="text-ink/70">
                  {r.product_id ? products.find((p) => p.id === r.product_id)?.name || 'Product'
                    : r.collection_id ? collections.find((c) => c.id === r.collection_id)?.name || 'Collection'
                    : r.event_id ? events.find((e) => e.id === r.event_id)?.name || 'Event'
                    : r.collaboration_id ? collaborations.find((c) => c.id === r.collaboration_id)?.name || 'Collaboration'
                    : '—'}
                </td>
                <td>
                  <button onClick={() => toggleEnabled(r)} aria-pressed={r.is_enabled} className={`badge-pill ${r.is_enabled ? 'bg-ink text-paper border-ink' : ''}`}>
                    {r.is_enabled ? 'On' : 'Off'}
                  </button>
                </td>
                <td className="text-right space-x-4">
                  <button onClick={() => edit(r)} className="btn-link">Edit</button>
                  <button onClick={() => duplicate(r)} className="btn-link">Duplicate</button>
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
