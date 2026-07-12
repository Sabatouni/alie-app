// Renders a CMS-managed image (from alie_media_library / alie_product_images / etc).
// Falls back to a branded duotone placeholder until real photography is uploaded,
// so layouts never look broken while content is still being populated.
export default function ImageSlot({ src, alt = '', tone = '', className = '' }) {
  if (src) {
    return <img src={src} alt={alt} className={`object-cover w-full h-full ${className}`} loading="lazy" />;
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
