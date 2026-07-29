// ALIÈ — device-local wishlist.
//
// There is no customer account system (ordering runs through WhatsApp), so a
// server-side wishlist would need auth we don't have. This persists to
// localStorage instead: the heart on a product card survives a refresh and a
// return visit on the same device, which is what a shopper actually expects.
//
// Storage is wrapped because Safari private mode throws on localStorage access.

const KEY = 'alie:wishlist';
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function write(ids) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Private mode / quota — the in-memory notification below still fires, so
    // the UI stays consistent for this session.
  }
  listeners.forEach((fn) => fn(ids));
}

export function getWishlist() {
  return read();
}

export function isWishlisted(productId) {
  return read().includes(productId);
}

export function toggleWishlist(productId) {
  const current = read();
  const next = current.includes(productId)
    ? current.filter((id) => id !== productId)
    : [...current, productId];
  write(next);
  return next.includes(productId);
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function subscribeWishlist(fn) {
  listeners.add(fn);
  const onStorage = (e) => { if (e.key === KEY) fn(read()); }; // other tabs
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener('storage', onStorage);
  };
}
