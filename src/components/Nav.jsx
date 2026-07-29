import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Search, Heart, Menu, X } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { getWishlist, subscribeWishlist } from '../lib/wishlist';

// Every entry here resolves to a route declared in App.jsx. The old list linked
// to /campaigns, /about and /collections/new-arrivals — React Router matched
// nothing and rendered a blank white page.
const LINKS = [
  { to: '/collections', label: 'Collections' },
  { to: '/journal', label: 'Journal' },
  { to: '/events', label: 'Events' },
  { to: '/collaborations', label: 'Collaborations' },
];

export default function Nav() {
  const { brand } = useSettings();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setWishlistCount(getWishlist().length);
    return subscribeWishlist((ids) => setWishlistCount(ids.length));
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const dark = scrolled || menuOpen;
  const brandName = brand.name || 'ALIÈ';

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-14 transition-all duration-500 ${
          dark ? 'py-4 bg-paper/90 backdrop-blur-md border-b border-ink/10' : 'py-6 bg-transparent'
        }`}
      >
        <Link
          to="/"
          onClick={() => setMenuOpen(false)}
          className={`font-display flex items-center gap-2.5 transition-all duration-500 ${
            dark ? 'text-ink text-2xl tracking-widest2' : 'text-paper text-[26px] tracking-[0.3em]'
          }`}
        >
          {brand.logo_url ? (
            <img src={brand.logo_url} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
          ) : (
            <svg viewBox="0 0 100 100" className="w-4 h-4 fill-current flex-shrink-0" aria-hidden="true">
              <path d="M50 5 C54 35,65 46,95 50 C65 54,54 65,50 95 C46 65,35 54,5 50 C35 46,46 35,50 5 Z" />
            </svg>
          )}
          {brandName}
        </Link>

        <ul className="hidden md:flex gap-9 list-none">
          {LINKS.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                className={({ isActive }) =>
                  `text-[11px] tracking-[0.14em] uppercase transition-colors duration-300 hover:text-camel ${
                    dark ? 'text-ink' : 'text-paper/85'
                  } ${isActive ? 'text-camel' : ''}`
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className={`flex items-center gap-5 transition-colors duration-500 ${dark ? 'text-ink' : 'text-paper'}`}>
          <Link to="/search" aria-label="Search products" className="hover:text-camel transition-colors">
            <Search size={17} strokeWidth={1.3} />
          </Link>
          <Link to="/wishlist" aria-label={`Wishlist, ${wishlistCount} saved`} className="relative hover:text-camel transition-colors">
            <Heart size={17} strokeWidth={1.3} />
            {wishlistCount > 0 && (
              <span className="absolute -top-1.5 -right-2 text-[9px] tabular-nums bg-camel text-paper rounded-full min-w-[15px] h-[15px] px-1 flex items-center justify-center">
                {wishlistCount}
              </span>
            )}
          </Link>
          <button
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden hover:text-camel transition-colors"
          >
            {menuOpen ? <X size={20} strokeWidth={1.3} /> : <Menu size={20} strokeWidth={1.3} />}
          </button>
        </div>
      </nav>

      <div
        className={`fixed inset-0 z-40 bg-paper transition-opacity duration-300 md:hidden ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!menuOpen}
      >
        <ul className="flex flex-col items-center justify-center h-full gap-8 list-none">
          {LINKS.map((l, i) => (
            <li
              key={l.to}
              className={`transition-all duration-500 ${menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
              style={{ transitionDelay: menuOpen ? `${i * 60}ms` : '0ms' }}
            >
              <Link
                to={l.to}
                onClick={() => setMenuOpen(false)}
                tabIndex={menuOpen ? 0 : -1}
                className="font-display text-3xl text-ink hover:text-camel transition-colors"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
