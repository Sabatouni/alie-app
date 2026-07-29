// ALIÈ — one place that decides what order product images appear in, and which
// one represents the product on cards, collection tiles and the homepage.
//
// The storefront queries pull `product_images:alie_product_images(*)` without a
// nested ORDER BY, so PostgREST returns them in whatever order the rows come
// back. Sorting here keeps every surface consistent without changing queries.

/** Ascending by sort_order, with a stable id tiebreak for legacy rows that all sit at 0. */
export function sortProductImages(images) {
  if (!Array.isArray(images)) return [];
  return [...images].sort((a, b) => {
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
}

/**
 * The image that represents this product everywhere: the explicit primary if
 * one is set, otherwise the first in sort order. Returns undefined when the
 * product has no images (callers fall back to ImageSlot's placeholder).
 */
export function primaryProductImage(images) {
  const sorted = sortProductImages(images);
  return sorted.find((i) => i.is_primary) || sorted[0];
}

/**
 * Gallery order for the product detail page: primary first, then the rest in
 * sort order. Same underlying rows — no file is duplicated to achieve this.
 */
export function galleryProductImages(images) {
  const sorted = sortProductImages(images);
  const primaryIndex = sorted.findIndex((i) => i.is_primary);
  if (primaryIndex <= 0) return sorted;
  const [primary] = sorted.splice(primaryIndex, 1);
  return [primary, ...sorted];
}
