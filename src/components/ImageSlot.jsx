import { useState } from 'react';
import { imageSrcSet, DEFAULT_SIZES } from '../lib/mediaUrl';

// Renders a CMS-managed image (from alie_media_library / alie_product_images / etc).
// Falls back to a branded duotone placeholder until real photography is uploaded,
// so layouts never look broken while content is still being populated.
//
// srcSet comes from lib/mediaUrl, which returns undefined unless Supabase image
// transformation is switched on — so the attribute is simply absent by default
// and the browser loads the (already optimizer-capped) original.
export default function ImageSlot({
  src,
  alt = '',
  tone = '',
  className = '',
  sizes = DEFAULT_SIZES,
  priority = false,
}) {
  const [loaded, setLoaded] = useState(false);

  if (src) {
    return (
      <img
        src={src}
        srcSet={imageSrcSet(src)}
        sizes={sizes}
        alt={alt}
        // Photography fades in on arrival rather than popping. The ref check
        // covers cached images whose load event fired before React attached
        // the handler; prefers-reduced-motion zeroes the transition globally.
        onLoad={() => setLoaded(true)}
        ref={(el) => { if (el && el.complete && el.naturalWidth > 0) setLoaded(true); }}
        className={`object-cover w-full h-full img-fade ${loaded ? 'is-loaded' : ''} ${className}`}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : undefined}
      />
    );
  }
  const toneClass =
    {
      sand: 'from-[#8f7f57] to-ink',
      mist: 'from-[#6d7566] to-ink',
      stone: 'from-[#54522f] to-ink',
      camel: 'from-[#5a4726] to-ink',
    }[tone] || 'from-[#4c4c14] to-ink';
  return <div className={`w-full h-full bg-gradient-to-br ${toneClass} ${className}`} aria-hidden="true" />;
}
