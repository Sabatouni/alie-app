// ALIÈ — assertion pass over the pure helpers behind the image uploader.
//
// These functions decide what gets rejected, which object gets deleted, and
// which photo represents a product — all of which are easy to break silently.
// Everything here is pure, so it runs without a browser or a Supabase session.
//
// Run with:  npm run verify:media

import assert from 'node:assert/strict';
import {
  formatBytes,
  sanitisePath,
  storagePathFromPublicUrl,
  validateImageFile,
} from '../src/lib/mediaUpload.js';
import { imageSrc, imageSrcSet } from '../src/lib/mediaUrl.js';
import {
  galleryProductImages,
  primaryProductImage,
  sortProductImages,
} from '../src/lib/productImages.js';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, message: err.message });
  }
}

const file = (name, type, size) => ({ name, type, size });

// ── Validation ──────────────────────────────────────────────────────────────

test('accepts jpg / jpeg / png / webp', () => {
  for (const [name, type] of [
    ['front.jpg', 'image/jpeg'],
    ['back.jpeg', 'image/jpeg'],
    ['side.png', 'image/png'],
    ['detail.webp', 'image/webp'],
  ]) {
    assert.equal(validateImageFile(file(name, type, 1024)), null, name);
  }
});

test('accepts uppercase extensions', () => {
  assert.equal(validateImageFile(file('LOOKBOOK.JPG', 'image/jpeg', 2048)), null);
});

test('accepts a file the browser gave no MIME type for', () => {
  assert.equal(validateImageFile(file('dragged.png', '', 2048)), null);
});

test('rejects gif, svg, avif, heic, pdf', () => {
  for (const [name, type] of [
    ['loop.gif', 'image/gif'],
    ['logo.svg', 'image/svg+xml'],
    ['shot.avif', 'image/avif'],
    ['IMG_0001.heic', 'image/heic'],
    ['lookbook.pdf', 'application/pdf'],
  ]) {
    const message = validateImageFile(file(name, type, 2048));
    assert.ok(message, `${name} should be rejected`);
    assert.match(message, /JPG, PNG or WEBP/);
  }
});

test('rejects files over the configured maximum', () => {
  const message = validateImageFile(file('huge.jpg', 'image/jpeg', 26 * 1024 * 1024));
  assert.ok(message);
  assert.match(message, /maximum/);
});

test('accepts a large file that is still under the maximum', () => {
  // The 9.6 MB test photo in the repo: rejected by the bucket raw, fine here
  // because the optimizer runs before upload.
  assert.equal(validateImageFile(file('test-photo-large.jpg', 'image/jpeg', 9646780)), null);
});

test('rejects empty files', () => {
  assert.match(validateImageFile(file('empty.png', 'image/png', 0)), /empty/);
});

// ── Storage paths ───────────────────────────────────────────────────────────

const publicUrl =
  'https://ref.supabase.co/storage/v1/object/public/alie-media/1720000000000-ab12cd-front.webp';

test('recovers the object path from a public URL', () => {
  assert.equal(
    storagePathFromPublicUrl(publicUrl),
    '1720000000000-ab12cd-front.webp'
  );
});

test('strips query strings from the path', () => {
  assert.equal(
    storagePathFromPublicUrl(`${publicUrl}?width=800`),
    '1720000000000-ab12cd-front.webp'
  );
});

test('decodes percent-encoded filenames', () => {
  assert.equal(
    storagePathFromPublicUrl('https://ref.supabase.co/storage/v1/object/public/alie-media/a%20b.png'),
    'a b.png'
  );
});

test('returns null for URLs outside the bucket', () => {
  // This is what stops "delete image" from trying to remove someone else's file.
  assert.equal(storagePathFromPublicUrl('https://images.example.com/photo.jpg'), null);
  assert.equal(storagePathFromPublicUrl(null), null);
  assert.equal(storagePathFromPublicUrl(undefined), null);
});

test('sanitises unsafe filenames', () => {
  assert.equal(sanitisePath('ALIÈ front / look #1.jpg'), 'ALI-front-look-1.jpg');
  assert.equal(sanitisePath('...'), '...');
  assert.equal(sanitisePath('///'), '');
});

test('formats byte counts', () => {
  assert.equal(formatBytes(2 * 1024 * 1024), '2.0 MB');
  assert.equal(formatBytes(500 * 1024), '500 KB');
});

// ── Ordering ────────────────────────────────────────────────────────────────

const gallery = [
  { id: 'c', sort_order: 2, is_primary: false },
  { id: 'a', sort_order: 0, is_primary: false },
  { id: 'b', sort_order: 1, is_primary: true },
];

test('sorts by sort_order', () => {
  assert.deepEqual(sortProductImages(gallery).map((i) => i.id), ['a', 'b', 'c']);
});

test('sorting does not mutate the input', () => {
  const before = gallery.map((i) => i.id);
  sortProductImages(gallery);
  assert.deepEqual(gallery.map((i) => i.id), before);
});

test('legacy rows all at sort_order 0 get a stable order', () => {
  const legacy = [
    { id: 'z', sort_order: 0, is_primary: false },
    { id: 'y', sort_order: 0, is_primary: false },
  ];
  assert.deepEqual(sortProductImages(legacy).map((i) => i.id), ['y', 'z']);
  assert.deepEqual(sortProductImages([...legacy].reverse()).map((i) => i.id), ['y', 'z']);
});

test('primary image is the flagged one', () => {
  assert.equal(primaryProductImage(gallery).id, 'b');
});

test('primary falls back to the first when nothing is flagged', () => {
  const unflagged = gallery.map((i) => ({ ...i, is_primary: false }));
  assert.equal(primaryProductImage(unflagged).id, 'a');
});

test('primary is undefined for a product with no images', () => {
  assert.equal(primaryProductImage([]), undefined);
  assert.equal(primaryProductImage(undefined), undefined);
  assert.equal(primaryProductImage(null), undefined);
});

test('detail gallery leads with the primary, keeps the rest in order', () => {
  assert.deepEqual(galleryProductImages(gallery).map((i) => i.id), ['b', 'a', 'c']);
});

test('detail gallery is unchanged when the primary is already first', () => {
  const firstIsPrimary = [
    { id: 'a', sort_order: 0, is_primary: true },
    { id: 'b', sort_order: 1, is_primary: false },
  ];
  assert.deepEqual(galleryProductImages(firstIsPrimary).map((i) => i.id), ['a', 'b']);
});

// ── Responsive URLs ─────────────────────────────────────────────────────────

const TRANSFORM_ON = process.env.EXPECT_TRANSFORM === 'true';

test(`srcSet is ${TRANSFORM_ON ? 'generated' : 'omitted'} for bucket URLs`, () => {
  const srcSet = imageSrcSet(publicUrl);
  if (!TRANSFORM_ON) {
    assert.equal(srcSet, undefined);
    assert.equal(imageSrc(publicUrl, 800), publicUrl);
    return;
  }
  assert.ok(srcSet);
  assert.equal(srcSet.split(', ').length, 5);
  assert.match(srcSet, /\/storage\/v1\/render\/image\/public\/alie-media\//);
  assert.match(srcSet, / 2400w$/);
  assert.ok(!srcSet.includes('/object/public/'));
});

test('srcSet is never generated for external URLs', () => {
  assert.equal(imageSrcSet('https://images.example.com/photo.jpg'), undefined);
  assert.equal(imageSrc('https://images.example.com/photo.jpg', 800), 'https://images.example.com/photo.jpg');
});

// ── Report ──────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? '  ✓' : '  ✗'} ${r.name}${r.ok ? '' : `\n      ${r.message}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed` + (TRANSFORM_ON ? ' (transform on)' : ''));
process.exit(failed.length ? 1 : 0);
