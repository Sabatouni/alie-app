import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// React Router keeps the scroll position across navigations, so clicking a
// product from halfway down a collection landed you halfway down the product
// page. Hash links (#arrivals) are left alone.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname, hash]);

  return null;
}
