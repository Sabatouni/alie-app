export default function Footer() {
  return (
    <footer className="bg-ink text-paper/75 px-6 md:px-14 pt-20 pb-9">
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-12 pb-14 border-b border-white/10">
        <div>
          <div className="font-display text-paper text-3xl tracking-widest2 flex items-center gap-2.5">
            <svg viewBox="0 0 100 100" className="w-5 h-5 fill-current">
              <path d="M50 5 C54 35,65 46,95 50 C65 54,54 65,50 95 C46 65,35 54,5 50 C35 46,46 35,50 5 Z" />
            </svg>
            ALIÈ
          </div>
          <p className="text-sm text-paper/60 mt-4 max-w-xs leading-relaxed">
            Considered clothing, cut for lasting wear and everyday elegance. Founded in Zanzibar.
          </p>
        </div>
        <FCol title="Shop" links={[['New Arrivals', '/collections/new-arrivals'], ['Collections', '/collections'], ['Sale', '/collections/sale']]} />
        <FCol title="Studio" links={[['About', '/about'], ['Journal', '/journal'], ['Collaborations', '/collaborations']]} />
        <FCol title="Care" links={[['Sizing Guide', '/sizing'], ['Shipping', '/shipping'], ['Returns', '/returns']]} />
      </div>
      <div className="flex justify-between items-center pt-6 text-xs text-paper/45 flex-wrap gap-3">
        <span>© {new Date().getFullYear()} ALIÈ. All rights reserved.</span>
        <div className="flex gap-4">
          <a href="#" className="hover:text-camel-soft">Instagram</a>
          <a href="#" className="hover:text-camel-soft">WhatsApp</a>
          <a href="#" className="hover:text-camel-soft">Pinterest</a>
        </div>
      </div>
    </footer>
  );
}

function FCol({ title, links }) {
  return (
    <div>
      <h4 className="text-[10px] tracking-[0.16em] uppercase text-paper/50 mb-4">{title}</h4>
      {links.map(([label, to]) => (
        <a key={to} href={to} className="block text-sm py-1 hover:text-camel-soft transition-colors">
          {label}
        </a>
      ))}
    </div>
  );
}
