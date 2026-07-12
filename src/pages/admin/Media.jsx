import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

const MAX_SIZE_MB = 8;

export default function Media() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  async function refresh() {
    setLoading(true);
    const { data, error: fetchErr } = await supabase.from('alie_media_library').select('*').order('created_at', { ascending: false });
    if (fetchErr) setError(fetchErr.message);
    setItems(data || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');

    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`That file is over ${MAX_SIZE_MB}MB. Compress it before uploading.`);
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const path = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      const { error: upErr } = await supabase.storage.from('alie-media').upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('alie-media').getPublicUrl(path);
      const { error: insertErr } = await supabase.from('alie_media_library').insert({
        filename: file.name,
        url: pub.publicUrl,
        uploaded_by: session?.user?.id,
      });
      if (insertErr) throw insertErr;
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.filename}"? Anything referencing it will fall back to a placeholder.`)) return;
    const path = item.url.split('/alie-media/').pop();
    await supabase.storage.from('alie-media').remove([path]);
    await supabase.from('alie_media_library').delete().eq('id', item.id);
    refresh();
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
      <p className="text-sm text-ink/50 mb-8">Upload here, then copy a URL into any image field across the admin.</p>

      <label className={`btn-primary inline-block cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
        {uploading ? 'Uploading…' : 'Upload Image'}
        <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700 mt-4 border border-red-200 bg-red-50 px-3 py-2 max-w-md">
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-10">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton aspect-square" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state mt-10">No media uploaded yet — the first upload will show here.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-10">
          {items.map((item) => (
            <div key={item.id} className="group relative">
              <img src={item.url} alt={item.filename} className="aspect-square object-cover w-full" loading="lazy" />
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
