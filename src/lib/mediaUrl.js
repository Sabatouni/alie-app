// ALIÈ — responsive display URLs.
//
// Supabase can resize images on the fly via /storage/v1/render/image/public/…,
// but that endpoint is a Pro-plan feature: on Free it returns 404 and every
// image on the site breaks. So transformation is OFF unless you opt in:
//
//   .env →  VITE_SUPABASE_IMAGE_TRANSFORM=true
//
// With it off, srcSet() returns undefined and <img> falls back to the plain
// public URL — which the client-side optimizer has already capped at 2400px
// on the long edge and re-encoded as WebP, so downloads stay reasonable.

import { BUCKET } from './mediaUpload';

const TRANSFORM_ENABLED = import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORM === 'true';

const OBJECT_SEGMENT = '/storage/v1/object/public/';
const RENDER_SEGMENT = '/storage/v1/render/image/public/';

/** Widths we generate. Matches the optimizer's 2400px ceiling. */
export const RESPONSIVE_WIDTHS = [400, 800, 1200, 1600, 2400];

/** Sensible default for the storefront's two-up / four-up product grids. */
export const DEFAULT_SIZES = '(max-width: 768px) 50vw, 25vw';

function isOwnBucketUrl(url) {
  return typeof url === 'string' && url.includes(OBJECT_SEGMENT + BUCKET + '/');
}

/**
 * A single display URL, optionally resized.
 * Returns the input untouched for external URLs or when transforms are off.
 */
export function imageSrc(url, width) {
  if (!TRANSFORM_ENABLED || !width || !isOwnBucketUrl(url)) return url;
  return `${url.replace(OBJECT_SEGMENT, RENDER_SEGMENT)}?width=${width}&resize=contain&quality=80`;
}

/**
 * A srcSet string, or undefined when there's nothing useful to offer.
 * `undefined` is deliberate: React omits the attribute entirely.
 */
export function imageSrcSet(url, widths = RESPONSIVE_WIDTHS) {
  if (!TRANSFORM_ENABLED || !isOwnBucketUrl(url)) return undefined;
  return widths.map((w) => `${imageSrc(url, w)} ${w}w`).join(', ');
}

/** Small square source for admin thumbnails — avoids pulling a 2400px file
 *  into a 160px box when transforms are available. */
export function thumbnailSrc(url, width = 400) {
  return imageSrc(url, width);
}
