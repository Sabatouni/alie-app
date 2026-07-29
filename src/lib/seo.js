// ALIÈ — per-route document metadata.
//
// This is a client-rendered SPA, so crawlers that execute JavaScript (Google,
// Bing) read what we set here. Static crawlers fall back to the defaults baked
// into index.html. Every public page calls setMeta on load.

const DEFAULT_TITLE = 'ALIÈ';

function upsert(selector, create) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

function setNamed(name, content) {
  const el = upsert(`meta[name="${name}"]`, () => {
    const m = document.createElement('meta');
    m.setAttribute('name', name);
    return m;
  });
  el.setAttribute('content', content || '');
}

function setProperty(property, content) {
  const el = upsert(`meta[property="${property}"]`, () => {
    const m = document.createElement('meta');
    m.setAttribute('property', property);
    return m;
  });
  el.setAttribute('content', content || '');
}

/**
 * @param {{title?:string, description?:string, image?:string, noindex?:boolean}} meta
 */
export function setMeta({ title, description, image, noindex = false } = {}) {
  const finalTitle = title || DEFAULT_TITLE;
  document.title = finalTitle;

  setNamed('description', description);
  setNamed('robots', noindex ? 'noindex, follow' : 'index, follow');

  setProperty('og:title', finalTitle);
  setProperty('og:description', description);
  setProperty('og:type', 'website');
  setProperty('og:url', window.location.href);
  if (image) setProperty('og:image', image);

  setNamed('twitter:card', image ? 'summary_large_image' : 'summary');
  setNamed('twitter:title', finalTitle);
  setNamed('twitter:description', description);
  if (image) setNamed('twitter:image', image);

  const canonical = upsert('link[rel="canonical"]', () => {
    const l = document.createElement('link');
    l.setAttribute('rel', 'canonical');
    return l;
  });
  canonical.setAttribute('href', window.location.origin + window.location.pathname);
}
