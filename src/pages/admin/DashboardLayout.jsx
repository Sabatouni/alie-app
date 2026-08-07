import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { LayoutGrid, Shirt, Layers, Calendar, Newspaper, Users, Clock, Image, ShoppingBag, Settings, Home, ExternalLink, UserCog } from 'lucide-react';

const NAV = [
  ['/admin', LayoutGrid, 'Overview'],
  ['/admin/homepage', Home, 'Homepage'],
  ['/admin/products', Shirt, 'Products'],
  ['/admin/collections', Layers, 'Collections'],
  ['/admin/events', Calendar, 'Events'],
  ['/admin/journal', Newspaper, 'Journal'],
  ['/admin/collaborations', Users, 'Collaborations'],
  ['/admin/countdowns', Clock, 'Countdowns'],
  ['/admin/media', Image, 'Media Library'],
  ['/admin/orders', ShoppingBag, 'Orders'],
  ['/admin/settings', Settings, 'Site Settings'],
];
// Team/role management is Owner-only -- hidden entirely for a plain Admin
// rather than shown-and-disabled.
const OWNER_NAV = ['/admin/team', UserCog, 'Team'];

export default function DashboardLayout() {
  const { session, signOut, isOwner } = useAuth();
  const { brand } = useSettings();
  const nav = isOwner ? [...NAV, OWNER_NAV] : NAV;

  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="w-60 bg-ink text-paper/80 flex flex-col px-5 py-8 shrink-0">
        <div className="font-display text-xl tracking-widest2 mb-10 px-2">{brand.name || 'ALIÈ'} Admin</div>
        <nav className="flex-1 space-y-1">
          {nav.map(([to, Icon, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm rounded transition-colors ${
                  isActive ? 'bg-paper/10 text-paper' : 'hover:bg-paper/5'
                }`
              }
            >
              <Icon size={16} strokeWidth={1.5} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 pt-6 border-t border-paper/10 text-xs space-y-2">
          <Link to="/" target="_blank" className="flex items-center gap-2 text-paper/50 hover:text-paper transition-colors">
            <ExternalLink size={13} strokeWidth={1.5} /> View site
          </Link>
          <div className="text-paper/50 truncate" title={session?.user?.email}>
            {session?.user?.email || 'Admin'}
          </div>
          <button onClick={signOut} className="underline hover:text-paper transition-colors">Sign out</button>
        </div>
      </aside>
      <main className="flex-1 p-10 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
