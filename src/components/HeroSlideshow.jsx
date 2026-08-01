import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ImageSlot from './ImageSlot';
import { imageSrcSet } from '../lib/mediaUrl';

// The original ALIÈ hero image system: the hero rotates through the newest
// campaign photography in the Media Library (alie_media_library, public-read).
// Admins upload once and the homepage updates automatically — no hardcoded
// arrays, no placeholder URLs, no code changes.
//
// The rotation is a luxury-campaign crossfade, not a carousel: every ~6
// seconds the next image fades in over the last while the visible frame
// drifts almost imperceptibly (scale 1.00 → 1.035). No arrows, no dots, no
// controls. Only opacity and transform animate, so it stays on the GPU.
//
// The hero section's own CMS image slot (Admin → Homepage → hero) stays the
// lead image when set; library images follow it. With one image the hero is
// simply static; with none, the existing gradient placeholder renders.
// prefers-reduced-motion disables the rotation entirely.

const ROTATE_MS = 6000; // within the requested 5–7s band
const MAX_IMAGES = 6;

export default function HeroSlideshow({ primaryUrl, alt = '' }) {
  const [libraryUrls, setLibraryUrls] = useState(null); // null = loading
  const [active, setActive] = useState(0);
  // Read once, lazily: the preference practically never changes mid-visit, and
  // the global reduced-motion CSS covers the transition side regardless.
  const [reducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('alie_media_library')
      .select('url')
      .order('created_at', { ascending: false })
      .limit(MAX_IMAGES)
      .then(({ data }) => {
        if (!cancelled) setLibraryUrls((data || []).map((m) => m.url).filter(Boolean));
      });
    return () => { cancelled = true; };
  }, []);

  // Lead with the admin's chosen hero image, then the newest library uploads,
  // deduped so the lead image never appears twice in one loop.
  const urls = useMemo(() => {
    const list = primaryUrl ? [primaryUrl] : [];
    for (const u of libraryUrls || []) {
      if (!list.includes(u)) list.push(u);
    }
    return list.slice(0, MAX_IMAGES);
  }, [primaryUrl, libraryUrls]);

  // Rotate — only when there's something to rotate through and the visitor
  // hasn't opted out of motion.
  useEffect(() => {
    if (reducedMotion || urls.length < 2) return undefined;
    const id = setInterval(() => setActive((i) => (i + 1) % urls.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [reducedMotion, urls.length]);

  // Preload the image after next so every crossfade lands on decoded pixels.
  useEffect(() => {
    if (urls.length < 2) return;
    const img = new Image();
    img.src = urls[(active + 1) % urls.length];
  }, [active, urls]);

  // Loading, or genuinely empty: the existing elegant gradient placeholder.
  if (libraryUrls === null && !primaryUrl) return null;
  if (urls.length === 0) {
    return <ImageSlot src={undefined} alt="" tone="sand" sizes="100vw" priority />;
  }

  // A single image needs no machinery.
  if (urls.length === 1 || reducedMotion) {
    return <ImageSlot src={urls[0]} alt={alt} tone="sand" sizes="100vw" priority />;
  }

  // Two stacked layers: the active frame (drifting) and its neighbours kept
  // mounted for seamless crossfades. Only active ± 1 render, so the browser
  // never downloads the whole library up front.
  const next = (active + 1) % urls.length;
  const prev = (active - 1 + urls.length) % urls.length;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden={alt ? undefined : true}>
      {urls.map((url, i) => {
        if (i !== active && i !== next && i !== prev) return null;
        const isActive = i === active;
        return (
          <div key={url} className={`hero-layer ${isActive ? 'is-active' : ''}`}>
            {/* key on the drift wrapper restarts the slow zoom each time the
                frame becomes active */}
            <div key={isActive ? `drift-${active}` : 'idle'} className={`w-full h-full ${isActive ? 'hero-drift' : ''}`}>
              <img
                src={url}
                srcSet={imageSrcSet(url)}
                sizes="100vw"
                alt={isActive ? alt : ''}
                className="object-cover w-full h-full"
                loading={i === active || i === next ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={i === active ? 'high' : undefined}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
