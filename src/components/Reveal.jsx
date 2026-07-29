import { useEffect, useRef, useState } from 'react';

// Scroll-reveal wrapper for the storefront's shared motion language.
// Elements start slightly translated/transparent (see .reveal in index.css)
// and settle once they enter the viewport. Purely presentational: children
// render immediately in the DOM, so SEO, layout and functionality are
// unaffected, and prefers-reduced-motion forces everything visible via CSS.
//
// variant: 'rise' (default) | 'fade' | 'scale' | 'mask' (for image frames)
// delay:   ms offset used to stagger siblings (e.g. product grids)
export default function Reveal({
  as: Tag = 'div',
  variant = 'rise',
  delay = 0,
  className = '',
  children,
  ...rest
}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    // No IntersectionObserver (very old browsers): never hide content.
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      // Fire slightly before the element fully enters view so sections feel
      // like they arrive with the scroll rather than after it.
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const variantClass = variant === 'mask' ? 'reveal-mask reveal-fade' : `reveal-${variant}`;

  return (
    <Tag
      ref={ref}
      className={`reveal ${variantClass} ${shown ? 'is-shown' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
