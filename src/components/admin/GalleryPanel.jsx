import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import ImageUploader from './ImageUploader';
import { removeIfUnreferenced } from '../../lib/mediaUpload';
import { thumbnailSrc } from '../../lib/mediaUrl';

// Multi-image gallery for tables that hold rows of {parent_id, url, sort_order}:
// alie_event_images and alie_collaboration_media. Both had schema, RLS and
// policies since 0001 and no way to put a row in them short of SQL.
//
// Products keep their own panel (ProductImagesPanel) because they carry
// is_primary and alt_text, which these tables don't have. Uploads for all three
// go through the same ImageUploader → lib/mediaUpload.js path.

export default function GalleryPanel({
  table,          // 'alie_event_images' | 'alie_collaboration_media'
  parentColumn,   // 'event_id' | 'collaboration_id'
  parentId,
  title = 'Gallery',
  description,
  extraColumns = {},   // e.g. { type: 'image' } for collaboration media
}) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const nextSort = useRef(0);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!parentId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(parentColumn, parentId)
      .order('sort_order', { ascending: true });
    if (!alive.current) return;
    if (error) toast?.error(error.message);
    const list = data || [];
    setRows(list);
    nextSort.current = list.length ? Math.max(...list.map((r) => r.sort_order ?? 0)) + 1 : 0;
    setLoading(false);
  }, [table, parentColumn, parentId, toast]);

  useEffect(() => { load(); }, [load]);

  const persistUpload = useCallback(async (result) => {
    const sortOrder = nextSort.current;
    const { data, error } = await supabase
      .from(table)
      .insert({ [parentColumn]: parentId, url: result.url, sort_order: sortOrder, ...extraColumns })
      .select()
      .single();
    if (error) throw error; // ImageUploader rolls the storage object back
    nextSort.current = sortOrder + 1;
    if (alive.current) setRows((list) => [...list, data]);
  }, [table, parentColumn, parentId, extraColumns]);

  async function persistOrder(ordered) {
    if (!ordered.length) return;
    const payload = ordered.map((row, index) => ({ ...row, sort_order: index }));
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    if (error) { toast?.error(error.message); load(); }
  }

  function move(index, delta) {
    const to = index + delta;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    const renumbered = next.map((r, i) => ({ ...r, sort_order: i }));
    setRows(renumbered);
    persistOrder(renumbered);
  }

  async function remove(row) {
    if (!confirm('Remove this image? The file is deleted from storage unless it is also in the Media Library.')) return;
    setBusyId(row.id);
    const { error } = await supabase.from(table).delete().eq('id', row.id);
    if (error) { setBusyId(null); toast?.error(error.message); return; }

    await removeIfUnreferenced(row.url);

    const remaining = rows.filter((r) => r.id !== row.id).map((r, i) => ({ ...r, sort_order: i }));
    if (alive.current) { setRows(remaining); setBusyId(null); }
    nextSort.current = remaining.length;
    await persistOrder(remaining);
    toast?.success('Image removed.');
  }

  if (!parentId) return null;

  return (
    <section className="border border-ink/10 p-6 mt-6" aria-labelledby={`gallery-${parentId}`}>
      <div className="flex items-baseline justify-between mb-1.5">
        <h3 id={`gallery-${parentId}`} className="font-display text-xl">{title}</h3>
        <span className="text-xs text-ink/40">{rows.length} {rows.length === 1 ? 'image' : 'images'}</span>
      </div>
      {description && <p className="text-sm text-ink/50 mb-5">{description}</p>}

      <ImageUploader onUpload={persistUpload} label="Add Images" compact />

      {loading ? (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-6">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton aspect-square" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-ink/45 mt-5">No images yet.</p>
      ) : (
        <ul className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-6">
          {rows.map((row, index) => (
            <li key={row.id} className={`group relative ${busyId === row.id ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="aspect-square overflow-hidden bg-stone/20">
                <img src={thumbnailSrc(row.url)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
              </div>
              <div className="absolute inset-0 bg-ink/75 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                <div className="flex gap-3">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move earlier" className="text-paper/80 text-sm disabled:opacity-25">←</button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === rows.length - 1} aria-label="Move later" className="text-paper/80 text-sm disabled:opacity-25">→</button>
                </div>
                <button type="button" onClick={() => remove(row)} className="text-paper text-[10px] tracking-[0.1em] uppercase underline hover:text-red-300">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
