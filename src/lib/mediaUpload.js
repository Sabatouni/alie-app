// ALIÈ — the single upload implementation for the whole project.
//
// Every image that reaches the `alie-media` bucket goes through uploadImage()
// below. The Media Library and the per-product Images panel both call it, so
// validation, optimization, path sanitising, error messages and orphan cleanup
// only exist in one place.
//
// If you find yourself writing `supabase.storage.from('alie-media').upload(...)`
// anywhere else, stop and use this module instead.

import { supabase } from './supabaseClient';
import { optimizeImage } from './imageOptimizer';

export const BUCKET = 'alie-media';

/** Formats the admin is allowed to upload. */
export const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** `accept` attribute for <input type="file">. Extensions are listed as well as
 *  MIME types because some browsers report an empty `type` for files dragged
 *  from certain sources. */
export const ACCEPT_ATTR = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

/** Largest file the admin may *select*. Anything under this is optimized down
 *  before upload; the bucket itself caps stored objects at 8 MB. */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/** Human-readable list used in validation copy: "JPG, JPEG, PNG or WEBP". */
export const ACCEPTED_LABEL = 'JPG, PNG or WEBP';

/** Thrown for problems the admin can fix themselves (wrong format, too big). */
export class UploadValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Strip characters that would break a Supabase Storage URL. */
export function sanitisePath(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function extensionOf(name) {
  const match = /\.([^.]+)$/.exec(name || '');
  return match ? match[1].toLowerCase() : '';
}

/**
 * Check a file before anything touches the network.
 * @returns {string|null} a friendly error message, or null when the file is fine.
 */
export function validateImageFile(file) {
  const ext = extensionOf(file.name);
  const typeOk = ACCEPTED_MIME_TYPES.includes(file.type);
  const extOk = ACCEPTED_EXTENSIONS.includes(ext);

  // A file passes if either signal says it's an accepted format — browsers
  // sometimes hand over an empty `type`, and some hand over a generic one.
  if (!typeOk && !extOk) {
    const shown = ext ? `.${ext}` : file.type || 'this file type';
    return `"${file.name}" is ${shown}. Only ${ACCEPTED_LABEL} images can be uploaded.`;
  }
  if (file.size === 0) {
    return `"${file.name}" is empty.`;
  }
  if (file.size > MAX_INPUT_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)}. The maximum is ${formatBytes(MAX_INPUT_BYTES)} — export a smaller version and retry.`;
  }
  return null;
}

/** Turn a Supabase error into something an admin can act on. */
export function friendlyUploadError(err) {
  if (err instanceof UploadValidationError) return err.message;

  // Kept from the original Media Library handler — these are the failure modes
  // that actually happened during ALIÈ's Supabase setup.
  console.error('[alie upload] full error:', err);
  console.error('[alie upload] code:', err?.code, '| status:', err?.status, '| statusCode:', err?.statusCode);
  console.error('[alie upload] details:', err?.details, '| hint:', err?.hint);

  const msg = err?.message ?? String(err);
  if (msg.includes('schema') || msg.includes('incompatible') || err?.statusCode === 400)
    return 'Storage 400 - run supabase/fixes/fix_storage_policies.sql in the Supabase SQL Editor, then retry. (' + msg + ')';
  if (msg.includes('bucket') && msg.includes('not found'))
    return 'The "alie-media" bucket does not exist. Run 0001_alie_init.sql first.';
  if (msg.includes('mime') || msg.includes('Mime'))
    return `Storage rejected this file type. The bucket accepts ${ACCEPTED_LABEL} images.`;
  if (msg.includes('maximum allowed size') || msg.includes('Payload too large') || err?.statusCode === 413)
    return 'The file is still over the bucket size limit after optimization. Export a smaller version and retry.';
  if (msg.includes('violates row-level security') || msg.includes('new row violates') || err?.statusCode === 403)
    return 'Upload blocked by RLS. Make sure you are logged in as admin, then run supabase/fixes/fix_storage_policies.sql.';
  if (msg.includes('JWT') || msg.includes('token') || msg.includes('auth'))
    return 'Session expired - sign out and sign back in, then retry.';
  return msg;
}

/**
 * Recover the object path inside the bucket from a public URL.
 * Returns null for URLs that don't live in our bucket (e.g. a pasted external
 * link), which callers use as "don't try to delete this from storage".
 */
export function storagePathFromPublicUrl(url) {
  if (typeof url !== 'string') return null;
  const marker = `/${BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const raw = url.slice(index + marker.length).split('?')[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Delete objects from the bucket. Silently ignores non-bucket URLs. */
export async function removeFromStorage(urlsOrPaths) {
  const paths = (Array.isArray(urlsOrPaths) ? urlsOrPaths : [urlsOrPaths])
    .map((v) => (v?.includes('://') ? storagePathFromPublicUrl(v) : v))
    .filter(Boolean);
  if (!paths.length) return;
  await supabase.storage.from(BUCKET).remove(paths);
}

/**
 * Is this URL still referenced anywhere else?
 *
 * Product images and Media Library entries can point at the same object (that's
 * the whole point of not duplicating files), so we never delete the underlying
 * object while another row still needs it.
 *
 * @param {string} url
 * @param {{ ignoreProductImageId?: string }} [opts]
 */
export async function isUrlReferencedElsewhere(url, { ignoreProductImageId } = {}) {
  const [library, productImages] = await Promise.all([
    supabase.from('alie_media_library').select('id').eq('url', url).limit(1),
    (() => {
      let q = supabase.from('alie_product_images').select('id').eq('url', url);
      if (ignoreProductImageId) q = q.neq('id', ignoreProductImageId);
      return q.limit(1);
    })(),
  ]);

  // On a query error, assume "referenced" — keeping an orphan object is far
  // cheaper than deleting a file another row is still displaying.
  if (library.error || productImages.error) return true;
  return (library.data?.length ?? 0) > 0 || (productImages.data?.length ?? 0) > 0;
}

/** Delete an object only when nothing else points at it. */
export async function removeIfUnreferenced(url, opts) {
  const path = storagePathFromPublicUrl(url);
  if (!path) return; // external URL — not ours to delete
  if (await isUrlReferencedElsewhere(url, opts)) return;
  await removeFromStorage([path]);
}

/**
 * Optimize and upload one image to the `alie-media` bucket.
 *
 * Note on progress: supabase-js has no upload progress event, so `onStage`
 * reports the pipeline stage ('validating' | 'optimizing' | 'uploading')
 * rather than a byte count. The UI turns that into a determinate bar.
 *
 * @param {File} rawFile
 * @param {{ onStage?: (stage: string) => void }} [opts]
 * @returns {Promise<{path:string,url:string,filename:string,contentType:string,width:number|null,height:number|null,originalBytes:number,finalBytes:number,savedBytes:number}>}
 */
export async function uploadImage(rawFile, { onStage } = {}) {
  onStage?.('validating');
  const invalid = validateImageFile(rawFile);
  if (invalid) throw new UploadValidationError(invalid);

  onStage?.('optimizing');
  const { file, info } = await optimizeImage(rawFile);

  onStage?.('uploading');
  const safeName = sanitisePath(file.name) || 'image.jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
  if (error) throw error;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    path,
    url: pub.publicUrl,
    filename: rawFile.name,
    contentType: file.type,
    width: info.width,
    height: info.height,
    originalBytes: info.originalBytes,
    finalBytes: info.finalBytes,
    savedBytes: Math.max(0, info.originalBytes - info.finalBytes),
  };
}
