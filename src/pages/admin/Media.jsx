import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { optimizeImage } from '../../lib/imageOptimizer';

/** Strip characters that would break a Supabase Storage URL. */
function sanitisePath(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function friendlyUploadError(err) {
  console.error('[Media upload] full error:', err);
  console.error('[Media upload] code:', err?.code, '| status:', err?.status, '| statusCode:', err?.statusCode);
  console.error('[Media upload] details:', err?.details, '| hint:', err?.hint);

  const msg = err?.message ?? String(err);
  if (msg.includes('schema') || msg.includes('incompatible') || err?.statusCode === 400)
    return 'Storage 400 - run supabase/fixes/fix_storage_policies.sql in the Supabase SQL Editor, then retry. (' + msg + ')';
  if (msg.includes('bucket') && msg.includes('not found'))
    return 'The "alie-media" bucket does not exist. Run 0001_alie_init.sql first.';
  if (msg.includes('violates row-level security') || msg.includes('new row violates') || err?.statusCode === 403)
    return 'Upload blocked by RLS. Make sure you are logged in as admin, then run supabase/fixes/fix_storage_policies.sql.';
  if (msg.includes('JWT') || msg.includes('token') || msg.includes('auth'))
    return 'Session expired - sign out and sign back in, then retry.';
  return msg;
}

export default function Media() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  // Guards against setState-after-unmount if the admin navigates away mid-upload.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  async function refresh() {
    const { data, error: fetchErr } = await supabase
      .from('alie_media_library')
      .select('*')
      .order('created_at', { ascending: false });
    if (!alive.current) return;
    if (fetchErr) setError(friendlyUploadError(fetchErr));
    setItems(data || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setNotice('');
    setUploading(true);

    const failures = [];
    let uploaded = 0;
    let savedBytes = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const raw = files[i];
        const label = files.length > 1 ? ` ${i + 1}/${files.length}` : '';
        try {
          if (alive.current) setUploadProgress(`Optimizing${label}...`);
          const { file, info } = await optimizeImage(raw);
          savedBytes += Math.max(0, info.originalBytes - info.finalBytes);

          if (alive.current) setUploadProgress(`Uploading${label}...`);
          const safeName = sanitisePath(file.name) || 'image.jpg';
          const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

          const { error: upErr } = await supabase.storage
            .from('alie-media')
            .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
          if (upErr) throw upErr;

          const { data: pub } = supabase.storage.from('alie-media').getPublicUrl(path);
          const { error: insertErr } = await supabase.from('alie_media_library').insert({
            filename: raw.name,
            url: pub.publicUrl,
            uploaded_by: session?.user?.id,
          });
          if (insertErr) {
            // Don't leave an orphaned object in storage if the DB row failed.
            await supabase.storage.from('alie-media').remove([path]);
            throw insertErr;
          }
          uploaded++;
        } catch (err) {
          failures.push(`${raw.name}: ${friendlyUploadError(err)}`);
        }
      }

      await refresh();
      if (!alive.current) return;
      if (uploaded > 0) {
        const saved = savedBytes > 512 * 1024 ? ` (saved ${(savedBytes / 1024 / 1024).toFixed(1)} MB via optimization)` : '';
        setNotice(`Uploaded ${uploaded} ${uploaded === 1 ? 'image' : 'images'}${saved}.`);
      }
      if (failures.length) setError(failures.join(' — '));
    } finally {
      if (alive.current) {
        setUploading(false);
        setUploadProgress('');
      }
    }
  }

  async function handleDelete(item) {
    if (!confirm('Delete "' + item.filename + '"? Anything referencing it will fall back to a placeholder.')) return;
    const path = decodeURIComponent(item.url.split('/alie-media/').pop());
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

      <label className={'btn-primary inline-block cursor-pointer' + (uploading ? ' opacity-60 pointer-events-none' : '')}>
        {uploading ? (uploadProgress || 'Uploading...') : 'Upload Images'}
        <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
      </label>

      {notice && (
        <p role="status" className="text-sm text-green-800 mt-4 border border-green-200 bg-green-50 px-3 py-2 max-w-md">
          {notice}
        </p>
      )}

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
        <div className="empty-state mt-10">No media uploaded yet - the first upload will show here.</div>
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
