import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutGrid, Shirt, Calendar, Newspaper, Users, Clock, Image, ShoppingBag, Settings, Home } from 'lucide-react';

const NAV = [
  ['/admin', LayoutGrid, 'Overview'],
  ['/admin/homepage', Home, 'Homepage'],
  ['/admin/products', Shirt, 'Products'],
  ['/admin/events', Calendar, 'Events'],
  ['/admin/journal', Newspaper, 'Journal'],
  ['/admin/collaborations', Users, 'Collaborations'],
  ['/admin/countdowns', Clock, 'Countdowns'],
  ['/admin/media', Image, 'Media Library'],
  ['/admin/orders', ShoppingBag, 'Orders'],
  ['/admin/settings', Settings, 'Site Settings'],
];

export default function DashboardLayout() {
  const { profile, signOut } = useAuth();
  return (
    <div className="min-h-screen flex bg-paper">
      <aside className="w-60 bg-ink text-paper/80 flex flex-col px-5 py-8">
        <div className="font-display text-xl tracking-widest2 mb-10 px-2">ALIÈ Admin</div>
        <nav className="flex-1 space-y-1">
          {NAV.map(([to, Icon, label]) => (
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
        <div className="px-3 pt-6 border-t border-paper/10 text-xs">
          <div className="text-paper/50">{profile?.full_name || 'Admin'}</div>
          <button onClick={signOut} className="mt-2 underline">Sign out</button>
        </div>
      </aside>
      <main className="flex-1 p-10 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
