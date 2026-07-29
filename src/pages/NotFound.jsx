import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { setMeta } from '../lib/seo';

// Without a catch-all, React Router matched nothing for unknown paths and
// rendered a blank white page between the nav and footer.

export default function NotFound() {
  useEffect(() => {
    setMeta({ title: 'Page not found — ALIÈ', noindex: true });
  }, []);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="eyebrow text-camel mb-4">404</div>
      <h1 className="font-display text-4xl md:text-5xl">This page doesn't exist</h1>
      <p className="text-sm text-ink/55 mt-4 max-w-sm leading-relaxed">
        The link may be out of date, or the page may have moved.
      </p>
      <div className="flex gap-6 mt-9 flex-wrap justify-center">
        <Link to="/" className="text-[11px] tracking-[0.16em] uppercase border-b border-ink pb-1">Home</Link>
        <Link to="/collections" className="text-[11px] tracking-[0.16em] uppercase border-b border-ink pb-1">Collections</Link>
        <Link to="/search" className="text-[11px] tracking-[0.16em] uppercase border-b border-ink pb-1">Search</Link>
      </div>
    </div>
  );
}
