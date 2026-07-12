import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

const STATUSES = ['pending', 'contacted', 'completed', 'cancelled'];

export default function Orders() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.from('alie_orders').select('*').order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(id, status) {
    const { error } = await supabase.from('alie_orders').update({ status }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Order status updated.');
    refresh();
  }

  function exportCsv() {
    if (rows.length === 0) { toast.error('No orders to export yet.'); return; }
    const header = ['Order Number', 'Status', 'Subtotal', 'Items', 'Created'];
    const lines = rows.map((r) => [
      r.order_number,
      r.status,
      r.subtotal,
      JSON.stringify(r.items).replace(/"/g, '""'),
      new Date(r.created_at).toISOString(),
    ].map((v) => `"${v}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alie-orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="font-display text-3xl">Orders</h1>
        <button onClick={exportCsv} className="btn-secondary">
          Export CSV
        </button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`badge-pill capitalize ${filter === s ? 'bg-ink text-paper border-ink' : ''}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-11" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {rows.length === 0 ? 'No orders yet — they appear here the moment a customer checks out via WhatsApp.' : 'No orders match this filter.'}
        </div>
      ) : (
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="table-head-row">
            <th className="py-3">Order</th><th>Items</th><th>Subtotal</th><th>Status</th><th>Date</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} className="table-row align-top">
              <td className="py-3 font-mono text-xs">{r.order_number}</td>
              <td className="text-xs max-w-xs">
                {(r.items || []).map((it, i) => <div key={i}>{it.name} — {it.color}/{it.size} × {it.quantity}</div>)}
              </td>
              <td>${r.subtotal}</td>
              <td>
                <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value)} className="border border-ink/20 px-2 py-1.5 text-xs bg-transparent capitalize focus:outline-none focus:border-ink transition-colors">
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td className="text-xs text-ink/50">{new Date(r.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
}
