import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Overview() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function load() {
      const [products, orders, pending] = await Promise.all([
        supabase.from('alie_products').select('id', { count: 'exact', head: true }),
        supabase.from('alie_orders').select('id', { count: 'exact', head: true }),
        supabase.from('alie_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      setStats({
        products: products.count ?? 0,
        orders: orders.count ?? 0,
        pending: pending.count ?? 0,
      });
    }
    load();
  }, []);

  const cards = [
    ['Products', stats?.products],
    ['Total Orders', stats?.orders],
    ['Pending Orders', stats?.pending],
  ];

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Overview</h1>
      <p className="text-sm text-ink/50 mb-8">A quick pulse on the store. Head to the individual modules for detail.</p>
      <div className="grid grid-cols-3 gap-6">
        {cards.map(([label, value]) => (
          <div key={label} className="card-panel">
            <div className="text-[11px] tracking-[0.14em] uppercase text-ink/50">{label}</div>
            {stats === null ? (
              <div className="skeleton h-10 w-16 mt-3" />
            ) : (
              <div className="font-display text-4xl mt-3 tabular-nums">{value}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
