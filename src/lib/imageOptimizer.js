// ALIÈ — client-side image optimization pipeline.
//
// Every image passes through here before it reaches Supabase Storage:
//   1. Decode (EXIF orientation respected, so phone photos aren't sideways).
//   2. Downscale to MAX_DIMENSION_PX on the long edge if larger.
//   3. Re-encode as WebP when the browser can encode it, otherwise JPEG.
//      PNGs with transparency keep their alpha channel (WebP or PNG, never JPEG).
//   4. If the result is somehow larger than the original *and* nothing was
//      resized or converted, the original file is kept instead.
//   5. Iterative quality back-off if the file is still over the soft target.
//
// No external dependencies — Canvas + createImageBitmap only.

const MAX_DIMENSION_PX = 2400;   // long edge — plenty for full-bleed retina display
const START_QUALITY = 0.85;      // visually lossless for photography at this size
const MIN_QUALITY = 0.6;         // never degrade below this
const SOFT_TARGET_BYTES = 2.5 * 1024 * 1024; // aim under 2.5 MB
const HARD_LIMIT_BYTES = 8 * 1024 * 1024;    // refuse to upload anything bigger than this *after* optimization

/** Cached WebP-encode support check. */
let webpSupported = null;
function canEncodeWebP() {
  if (webpSupported !== null) return webpSupported;
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  webpSupported = c.toDataURL('image/webp').startsWith('data:image/webp');
  return webpSupported;
}

/** Decode a File into a drawable bitmap, honouring EXIF orientation. */
async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // fall through to <img> decoding (e.g. unsupported options / formats)
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new DecodeError(file));
    };
    img.src = url;
  });
}

class DecodeError extends Error {
  constructor(file) {
    const isHeic = /\.hei[cf]$/i.test(file.name) || /hei[cf]/.test(file.type);
    super(
      isHeic
        ? `"${file.name}" is an Apple HEIC photo this browser can't read. On iPhone: Settings → Camera → Formats → "Most Compatible", or share the photo as JPEG and retry.`
        : `"${file.name}" could not be read as an image. It may be corrupted or an unsupported format.`
    );
    this.name = 'DecodeError';
  }
}

/** Detect whether a decoded PNG actually uses transparency. */
function hasAlpha(bitmap) {
  const size = 32; // sampling at a small size is enough to detect alpha use
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, size, size);
  const px = ctx.getImageData(0, 0, size, size).data;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 255) return true;
  return false;
}

function encode(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image encoding failed in this browser.'))),
      type,
      quality
    );
  });
}

function replaceExt(name, ext) {
  return name.replace(/\.[^.]+$/, '') + ext;
}

/**
 * Optimize an image File for web display.
 * @returns {Promise<{file: File, info: {originalBytes:number, finalBytes:number, width:number, height:number, converted:boolean, resized:boolean}}>}
 * @throws {Error} with a user-friendly message when the file can't be processed.
 */
export async function optimizeImage(original) {
  if (!original.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|avif|hei[cf])$/i.test(original.name)) {
    throw new Error(`"${original.name}" is not an image file.`);
  }

  // SVGs are already tiny and lose fidelity if rasterized — pass through untouched.
  if (original.type === 'image/svg+xml') {
    return { file: original, info: passthroughInfo(original) };
  }

  const bitmap = await decode(original);
  const srcW = bitmap.width;
  const srcH = bitmap.height;

  // Target dimensions.
  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(srcW, srcH));
  const outW = Math.max(1, Math.round(srcW * scale));
  const outH = Math.max(1, Math.round(srcH * scale));
  const resized = scale < 1;

  // Target format.
  const isPng = original.type === 'image/png';
  const alpha = isPng && hasAlpha(bitmap);
  const webp = canEncodeWebP();
  let type, ext;
  if (alpha) {
    type = webp ? 'image/webp' : 'image/png'; // keep transparency
    ext = webp ? '.webp' : '.png';
  } else {
    type = webp ? 'image/webp' : 'image/jpeg';
    ext = webp ? '.webp' : '.jpg';
  }

  // Small file, no resize, already an efficient web format → keep the original.
  const efficient = ['image/webp', 'image/jpeg', 'image/png', 'image/avif'].includes(original.type);
  if (!resized && efficient && original.size <= 400 * 1024) {
    if (bitmap.close) bitmap.close();
    return { file: original, info: passthroughInfo(original, srcW, srcH) };
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!alpha) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, outW, outH); } // JPEG/opaque: white behind any stray alpha
  ctx.drawImage(bitmap, 0, 0, outW, outH);
  if (bitmap.close) bitmap.close();

  // Encode, backing off quality until under the soft target (or quality floor).
  let quality = START_QUALITY;
  let blob = await encode(canvas, type, quality);
  while (blob.size > SOFT_TARGET_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.1);
    blob = await encode(canvas, type, quality);
  }

  const converted = type !== original.type;
  // If we made it bigger without changing anything useful, keep the original.
  if (blob.size >= original.size && !resized && !converted) {
    return { file: original, info: passthroughInfo(original, srcW, srcH) };
  }

  if (blob.size > HARD_LIMIT_BYTES) {
    throw new Error(
      `"${original.name}" is still ${(blob.size / 1024 / 1024).toFixed(1)} MB after optimization ` +
      `(limit ${(HARD_LIMIT_BYTES / 1024 / 1024).toFixed(0)} MB). Try cropping it or exporting a smaller version.`
    );
  }

  const file = new File([blob], replaceExt(original.name, ext), { type });
  return {
    file,
    info: {
      originalBytes: original.size,
      finalBytes: file.size,
      width: outW,
      height: outH,
      converted,
      resized,
    },
  };
}

function passthroughInfo(file, width = null, height = null) {
  return {
    originalBytes: file.size,
    finalBytes: file.size,
    width,
    height,
    converted: false,
    resized: false,
  };
}
