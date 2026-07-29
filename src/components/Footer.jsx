import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

// Nothing in this footer is hardcoded any more. Blurb, columns, social links and
// copyright all come from alie_site_settings and are editable under
// Admin → Site Settings. Anything an admin hasn't filled in is omitted rather
// than replaced with placeholder copy.

export default function Footer() {
  const { brand, social, footer } = useSettings();

  const socialLinks = [
    ['Instagram', social.instagram],
    ['WhatsApp', social.whatsapp],
    ['Pinterest', social.pinterest],
  ].filter(([, url]) => url);

  const columns = (footer.columns || []).filter((c) => c?.title && (c.links || []).length);
  const year = new Date().getFullYear();
  const brandName = brand.name || 'ALIÈ';

  return (
    <footer className="bg-ink text-paper/75 px-6 md:px-14 pt-20 pb-9">
      {/* Column count is admin-controlled, so the grid uses fixed responsive
          breakpoints rather than an arbitrary-value template Tailwind would
          have to generate per count. */}
      <div className={`grid grid-cols-1 gap-12 pb-14 border-b border-white/10 ${columns.length ? 'sm:grid-cols-2 lg:grid-cols-4' : ''}`}>
        <div>
          <div className="font-display text-paper text-3xl tracking-widest2 flex items-center gap-2.5">
            {brand.logo_url ? (
              <img src={brand.logo_url} alt="" className="w-5 h-5 object-contain" />
            ) : (
              <svg viewBox="0 0 100 100" className="w-5 h-5 fill-current" aria-hidden="true">
                <path d="M50 5 C54 35,65 46,95 50 C65 54,54 65,50 95 C46 65,35 54,5 50 C35 46,46 35,50 5 Z" />
              </svg>
            )}
            {brandName}
          </div>
          {footer.blurb && (
            <p className="text-sm text-paper/60 mt-4 max-w-xs leading-relaxed">{footer.blurb}</p>
          )}
          {brand.email && (
            <a href={`mailto:${brand.email}`} className="inline-block text-sm text-paper/60 mt-4 hover:text-camel-soft transition-colors">
              {brand.email}
            </a>
          )}
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-[10px] tracking-[0.16em] uppercase text-paper/50 mb-4">{col.title}</h4>
            {(col.links || []).filter((l) => l?.label && l?.to).map((l) => (
              <FooterLink key={`${l.label}-${l.to}`} to={l.to} label={l.label} />
            ))}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-6 text-xs text-paper/45 flex-wrap gap-3">
        <span>{footer.copyright ? footer.copyright.replace('{year}', year) : `© ${year} ${brandName}`}</span>
        {socialLinks.length > 0 && (
          <div className="flex gap-4">
            {socialLinks.map(([label, url]) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-camel-soft transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}

// Internal paths route through React Router; anything absolute opens normally.
function FooterLink({ to, label }) {
  const isInternal = to.startsWith('/');
  const className = 'block text-sm py-1 hover:text-camel-soft transition-colors';
  return isInternal ? (
    <Link to={to} className={className}>{label}</Link>
  ) : (
    <a href={to} target="_blank" rel="noopener noreferrer" className={className}>{label}</a>
  );
}
