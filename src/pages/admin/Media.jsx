import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ImageUploader from '../../components/admin/ImageUploader';
import { friendlyUploadError, removeIfUnreferenced } from '../../lib/mediaUpload';
import { thumbnailSrc } from '../../lib/mediaUrl';

// The Media Library is now a thin consumer of the shared uploader: it supplies
// the "what to do with the URL" half (insert an alie_media_library row) and
// nothing else. Validation, optimization, storage upload, progress, error
// copy and orphan rollback all live in ImageUploader / lib/mediaUpload.js,
// shared with the per-product Images panel.

export default function Media() {
  const { session } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  // Guards against setState-after-unmount if the admin navigates away mid-upload.
  // NOTE: alive.current must be set true INSIDE the effect — React StrictMode
  // mounts/unmounts/remounts in dev, and a ref initialised only at declaration
  // would stay false after the throwaway unmount, silently dropping all updates.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('alie_media_library')
      .select('*')
      .order('created_at', { ascending: false });
    if (!alive.current) return;
    if (error) toast?.error(friendlyUploadError(error));
    setItems(data || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  // Runs once per successfully uploaded file. Throwing here makes ImageUploader
  // delete the object it just wrote, so a failed insert never leaves an orphan.
  const persistUpload = useCallback(async (result) => {
    const { data, error } = await supabase
      .from('alie_media_library')
      .insert({
        filename: result.filename,
        url: result.url,
        uploaded_by: session?.user?.id,
      })
      .select()
      .single();
    if (error) throw error;
    if (alive.current) setItems((list) => [data, ...list]);
  }, [session?.user?.id]);

  async function handleDelete(item) {
    if (!confirm('Delete "' + item.filename + '"? Anything referencing it will fall back to a placeholder.')) return;

    const { error } = await supabase.from('alie_media_library').delete().eq('id', item.id);
    if (error) { toast?.error(friendlyUploadError(error)); return; }

    // Only drop the file itself if no product is still displaying it.
    await removeIfUnreferenced(item.url);

    if (alive.current) setItems((list) => list.filter((i) => i.id !== item.id));
    toast?.success('Image deleted.');
  }

  function copyUrl(item) {
    navigator.clipboard.writeText(item.url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="font-display text-3xl">Media Library</h1>
        <span className="text-xs text-ink/40">{items.length} {items.length === 1 ? 'image' : 'images'}</span>
      </div>
      <p className="text-sm text-ink/50 mb-8">
        General-purpose image store. For product photography, upload directly under Products → Images.
      </p>

      <ImageUploader onUpload={persistUpload} label="Upload Images" className="max-w-2xl" />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-10">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton aspect-square" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state mt-10">No media uploaded yet - the first upload will show here.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-10">
          {items.map((item) => (
            <div key={item.id} className="group relative">
              <img
                src={thumbnailSrc(item.url)}
                alt={item.filename}
                className="aspect-square object-cover w-full"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-ink/75 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 p-2 text-center">
                <span className="text-paper/70 text-[10px] truncate max-w-full px-2">{item.filename}</span>
                <button onClick={() => copyUrl(item)} className="text-paper text-[10px] tracking-[0.1em] uppercase underline">
                  {copiedId === item.id ? 'Copied' : 'Copy URL'}
                </button>
                <button onClick={() => handleDelete(item)} className="text-paper text-[10px] tracking-[0.1em] uppercase underline hover:text-red-300">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
