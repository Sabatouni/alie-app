import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import ImageSlot from './ImageSlot';

// Floating editorial photography for the hero — luxury magazine pages
// layered in space. Imagery comes live from the Media Library
// (alie_media_library, public-read), so the moment an admin uploads or
// replaces images there, the hero updates on the next load. Nothing is
// hardcoded; when the library is empty each frame falls back to the same
// branded duotone gradient ImageSlot already provides.
//
// Movement is deliberately restrained: a few pixels over 16–26 seconds,
// different speeds per frame, opacity breathing barely at all. All frames
// are aria-hidden (decorative) and hidden below md so mobile stays calm.
export default function FloatingImages({ excludeUrl }) {
  const [images, setImages] = useState(null); // null = loading, [] = none

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('alie_media_library')
      .select('id, url, alt_text')
      .order('created_at', { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (cancelled) return;
        // Don't repeat the main hero image as a floating fragment.
        setImages((data || []).filter((m) => m.url && m.url !== excludeUrl).slice(0, 2));
      });
    return () => { cancelled = true; };
  }, [excludeUrl]);

  // Wait for the query before rendering so gradients don't flash in and get
  // replaced a frame later by photographs.
  if (images === null) return null;

  // The masthead sits center-left, so the entire right half is free for the
  // layered frames — staggered like magazine cutouts, one higher and larger,
  // one lower and smaller, overlapping diagonally. The smaller one only
  // appears on large screens so tablets get a single, calmer accent.
  const frames = [
    {
      className: 'top-[18%] right-[8%] w-44 lg:w-56 aspect-[3/4] float-slow',
      tone: 'stone',
    },
    {
      className: 'bottom-[16%] right-[22%] w-32 lg:w-40 aspect-[4/5] float-drift hidden lg:block',
      tone: 'camel',
    },
  ];

  return (
    <div className="absolute inset-0 z-[5] pointer-events-none hidden md:block" aria-hidden="true">
      {frames.map((frame, i) => (
        <div
          key={i}
          className={`absolute overflow-hidden shadow-[0_32px_64px_-32px_rgba(35,35,3,0.5)] ${frame.className}`}
        >
          <ImageSlot
            src={images[i]?.url}
            alt=""
            tone={frame.tone}
            sizes="240px"
          />
        </div>
      ))}
    </div>
  );
}
