import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import ImageUploader from './ImageUploader';
import {
  ACCEPT_ATTR,
  friendlyUploadError,
  removeFromStorage,
  removeIfUnreferenced,
  uploadImage,
  validateImageFile,
} from '../../lib/mediaUpload';
import { thumbnailSrc } from '../../lib/mediaUrl';
import { sortProductImages } from '../../lib/productImages';

// Per-product gallery management: upload, reorder, set primary, replace, delete.
//
// Uploads go through ImageUploader → lib/mediaUpload.js, the same path the
// Media Library uses. Nothing in this file talks to Supabase Storage directly
// except through those helpers.

export default function ProductImagesPanel({ productId, productName }) {
  const toast = useToast();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Mirrors `images` so the upload loop can allocate sort_order and decide the
  // first-image-is-primary rule without waiting for React state to flush
  // between files in the same batch.
  const stateRef = useRef({ nextSort: 0, hasPrimary: false });

  const load = useCallback(async () => {
    if (!productId) {
      setImages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('alie_product_images')
      .select('*')
      .eq('product_id', productId)
      .order('sort_order', { ascending: true });

    if (!alive.current) return;
    if (error) {
      toast?.error(friendlyUploadError(error));
      setImages([]);
    } else {
      const sorted = sortProductImages(data || []);
      setImages(sorted);
      stateRef.current = {
        nextSort: sorted.length ? Math.max(...sorted.map((i) => i.sort_order ?? 0)) + 1 : 0,
        hasPrimary: sorted.some((i) => i.is_primary),
      };
    }
    setLoading(false);
  }, [productId, toast]);

  useEffect(() => { load(); }, [load]);

  // ── Upload ────────────────────────────────────────────────────────────────

  const persistUpload = useCallback(async (result) => {
    const isPrimary = !stateRef.current.hasPrimary;
    const sortOrder = stateRef.current.nextSort;

    const { data, error } = await supabase
      .from('alie_product_images')
      .insert({
        product_id: productId,
        url: result.url,
        alt_text: productName || null,
        sort_order: sortOrder,
        is_primary: isPrimary,
      })
      .select()
      .single();

    if (error) throw error; // ImageUploader rolls the storage object back

    stateRef.current.nextSort = sortOrder + 1;
    if (isPrimary) stateRef.current.hasPrimary = true;

    // Append immediately so the thumbnail is on screen before the next file
    // in the batch starts — no page refresh, no waiting for the batch to end.
    if (alive.current) setImages((list) => [...list, data]);
  }, [productId, productName]);

  // ── Reorder ───────────────────────────────────────────────────────────────

  async function persistOrder(ordered) {
    if (!ordered.length) return; // nothing to renumber; an empty upsert is a pointless round trip
    const payload = ordered.map((img, index) => ({
      id: img.id,
      product_id: img.product_id,
      url: img.url,
      alt_text: img.alt_text,
      is_primary: img.is_primary,
      sort_order: index,
    }));

    const { error } = await supabase.from('alie_product_images').upsert(payload, { onConflict: 'id' });
    if (error) {
      toast?.error(friendlyUploadError(error));
      load(); // snap back to whatever the database actually holds
      return;
    }
    stateRef.current.nextSort = ordered.length;
  }

  function moveTo(from, to) {
    if (from === to || from == null || to == null) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const renumbered = next.map((img, index) => ({ ...img, sort_order: index }));
    setImages(renumbered); // optimistic
    persistOrder(renumbered);
  }

  // ── Primary ───────────────────────────────────────────────────────────────

  async function setPrimary(image) {
    if (image.is_primary) return;
    setBusyId(image.id);
    const previous = images;
    setImages((list) => list.map((i) => ({ ...i, is_primary: i.id === image.id })));

    // Clear the old flag first: a product must never have two primaries, and
    // clearing before setting is the order that stays valid even if a unique
    // partial index is added later.
    const clear = await supabase
      .from('alie_product_images')
      .update({ is_primary: false })
      .eq('product_id', productId)
      .eq('is_primary', true);

    const set = clear.error
      ? clear
      : await supabase.from('alie_product_images').update({ is_primary: true }).eq('id', image.id);

    if (alive.current) setBusyId(null);
    if (set.error) {
      toast?.error(friendlyUploadError(set.error));
      // The clear may already have committed, so `previous` is not necessarily
      // what the database now holds — re-read rather than show a stale badge.
      setImages(previous);
      load();
      return;
    }
    stateRef.current.hasPrimary = true;
    toast?.success('Primary image updated.');
  }

  // ── Replace ───────────────────────────────────────────────────────────────

  async function replaceImage(image, file) {
    const invalid = validateImageFile(file);
    if (invalid) { toast?.error(invalid); return; }

    setBusyId(image.id);
    const oldUrl = image.url;
    let uploadedPath = null;
    try {
      const result = await uploadImage(file);
      uploadedPath = result.path;

      const { data, error } = await supabase
        .from('alie_product_images')
        .update({ url: result.url })
        .eq('id', image.id)
        .select()
        .single();
      if (error) throw error;

      if (alive.current) setImages((list) => list.map((i) => (i.id === image.id ? data : i)));

      // Only now is the old object safe to drop — and only if nothing else
      // (Media Library, another product) still points at it.
      await removeIfUnreferenced(oldUrl, { ignoreProductImageId: image.id });
      toast?.success('Image replaced.');
    } catch (err) {
      if (uploadedPath) await removeFromStorage([uploadedPath]);
      toast?.error(friendlyUploadError(err));
    } finally {
      if (alive.current) setBusyId(null);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function deleteImage(image) {
    if (!confirm('Remove this image from the product? The file is deleted from storage unless it is also in the Media Library.')) return;

    setBusyId(image.id);
    const { error } = await supabase.from('alie_product_images').delete().eq('id', image.id);
    if (error) {
      if (alive.current) setBusyId(null);
      toast?.error(friendlyUploadError(error));
      return;
    }

    await removeIfUnreferenced(image.url, { ignoreProductImageId: image.id });

    const remaining = images.filter((i) => i.id !== image.id).map((img, index) => ({ ...img, sort_order: index }));

    // Never leave a product without a primary.
    if (image.is_primary && remaining.length) {
      remaining[0] = { ...remaining[0], is_primary: true };
      await supabase.from('alie_product_images').update({ is_primary: true }).eq('id', remaining[0].id);
    }

    if (alive.current) {
      setImages(remaining);
      setBusyId(null);
    }
    stateRef.current.hasPrimary = remaining.some((i) => i.is_primary);
    await persistOrder(remaining);
    toast?.success('Image removed.');
  }

  // ── Alt text ──────────────────────────────────────────────────────────────

  async function saveAltText(image, value) {
    const next = value.trim();
    if (next === (image.alt_text || '')) return;
    setImages((list) => list.map((i) => (i.id === image.id ? { ...i, alt_text: next } : i)));
    const { error } = await supabase.from('alie_product_images').update({ alt_text: next || null }).eq('id', image.id);
    if (error) toast?.error(friendlyUploadError(error));
  }

  if (!productId) return null;

  return (
    <section className="card-panel mb-10" aria-labelledby="product-images-heading">
      <div className="flex items-baseline justify-between mb-1.5">
        <h2 id="product-images-heading" className="font-display text-2xl">Images</h2>
        <span className="text-xs text-ink/40">
          {images.length} {images.length === 1 ? 'image' : 'images'}
        </span>
      </div>
      <p className="text-sm text-ink/50 mb-6">
        Drag thumbnails to reorder. The primary image is used on product cards, collection tiles and the homepage.
      </p>

      <ImageUploader
        onUpload={persistUpload}
        label="Add Images"
        hint="Drag & drop or click to browse · JPG, PNG or WEBP · front, back, side, detail, lifestyle"
        compact
      />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-7">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton aspect-[3/4]" />)}
        </div>
      ) : images.length === 0 ? (
        <div className="empty-state mt-7">No images yet — upload the first one above.</div>
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-7">
          {images.map((image, index) => (
            <li
              key={image.id}
              draggable
              onDragStart={(e) => { setDragIndex(index); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverIndex(index); }}
              onDragLeave={() => setOverIndex((v) => (v === index ? null : v))}
              onDrop={(e) => { e.preventDefault(); moveTo(dragIndex, index); setDragIndex(null); setOverIndex(null); }}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
              className={[
                'group relative border transition-colors duration-150 cursor-grab active:cursor-grabbing',
                overIndex === index && dragIndex !== index ? 'border-camel' : 'border-transparent',
                dragIndex === index ? 'opacity-40' : '',
                busyId === image.id ? 'pointer-events-none' : '',
              ].join(' ')}
            >
              <div className="relative aspect-[3/4] bg-stone/20 overflow-hidden">
                <img
                  src={thumbnailSrc(image.url)}
                  alt={image.alt_text || `${productName || 'Product'} image ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />

                {image.is_primary && (
                  <span className="absolute top-2 left-2 text-[9px] tracking-[0.14em] uppercase px-2 py-1 bg-ink text-paper">
                    Primary
                  </span>
                )}
                {busyId === image.id && (
                  <div className="absolute inset-0 bg-paper/70 flex items-center justify-center text-[10px] tracking-[0.14em] uppercase text-ink/60">
                    Working…
                  </div>
                )}

                <div className="absolute inset-0 bg-ink/75 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                  {!image.is_primary && (
                    <button type="button" onClick={() => setPrimary(image)} className="text-paper text-[10px] tracking-[0.1em] uppercase underline">
                      Set Primary
                    </button>
                  )}
                  <label className="text-paper text-[10px] tracking-[0.1em] uppercase underline cursor-pointer">
                    Replace
                    <input
                      type="file"
                      accept={ACCEPT_ATTR}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) replaceImage(image, file);
                      }}
                    />
                  </label>
                  <button type="button" onClick={() => deleteImage(image)} className="text-paper text-[10px] tracking-[0.1em] uppercase underline hover:text-red-300">
                    Delete
                  </button>
                  <div className="flex gap-3 mt-1">
                    <button
                      type="button"
                      onClick={() => moveTo(index, index - 1)}
                      disabled={index === 0}
                      aria-label="Move image earlier"
                      className="text-paper/80 text-sm disabled:opacity-25 hover:text-paper"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTo(index, index + 1)}
                      disabled={index === images.length - 1}
                      aria-label="Move image later"
                      className="text-paper/80 text-sm disabled:opacity-25 hover:text-paper"
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>

              <input
                type="text"
                defaultValue={image.alt_text || ''}
                placeholder="Alt text"
                aria-label={`Alt text for image ${index + 1}`}
                onBlur={(e) => saveAltText(image, e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                draggable={false}
                onDragStart={(e) => e.stopPropagation()}
                className="field-input mt-2 text-xs py-1.5 cursor-text"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
