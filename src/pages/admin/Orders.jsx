import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

const STATUSES = ['pending', 'contacted', 'completed', 'cancelled'];

export default function Orders() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.from('alie_orders').select('*').order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(id, status) {
    const previous = rows;
    setRows((list) => list.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await supabase.from('alie_orders').update({ status }).eq('id', id);
    if (error) { setRows(previous); toast.error(error.message); return; }
    toast.success('Order status updated.');
  }

  async function updateNotes(id, notes) {
    const { error } = await supabase.from('alie_orders').update({ notes: notes || null }).eq('id', id);
    if (error) toast.error(error.message);
    else setRows((list) => list.map((r) => (r.id === id ? { ...r, notes } : r)));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => filter === 'all' || r.status === filter)
      .filter((r) => !q
        || r.order_number?.toLowerCase().includes(q)
        || r.customer_name?.toLowerCase().includes(q)
        || r.customer_phone?.toLowerCase().includes(q)
        || (r.items || []).some((it) => it.name?.toLowerCase().includes(q)));
  }, [rows, filter, search]);

  const revenue = filtered.reduce((sum, r) => sum + Number(r.subtotal || 0), 0);

  function exportCsv() {
    if (filtered.length === 0) { toast.error('Nothing to export with the current filter.'); return; }

    // One row per line item rather than a JSON blob in a cell — the old export
    // dumped the whole items array as escaped JSON, which is unusable in Excel.
    const header = ['Order Number', 'Date', 'Status', 'Customer', 'Phone', 'Product', 'Colour', 'Size', 'Qty', 'Unit Price', 'Order Subtotal'];
    const lines = [];
    for (const r of filtered) {
      const items = (r.items || []).length ? r.items : [{}];
      for (const it of items) {
        lines.push([
          r.order_number, new Date(r.created_at).toISOString(), r.status,
          r.customer_name || '', r.customer_phone || '',
          it.name || '', it.color || '', it.size || '', it.quantity ?? '',
          it.price ?? '', r.subtotal ?? '',
        ].map(csvCell).join(','));
      }
    }

    // CRLF and a UTF-8 BOM: without the BOM Excel renders "ALIÈ" as mojibake.
    const csv = '﻿' + [header.map(csvCell).join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alie-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <h1 className="font-display text-3xl">Orders</h1>
        <button onClick={exportCsv} className="btn-secondary">Export CSV</button>
      </div>
      <p className="text-sm text-ink/50 mb-8">
        An order row is created the moment a customer taps Order via WhatsApp, before the chat opens.
      </p>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order number, customer or product…"
          aria-label="Search orders"
          className="field-input max-w-xs"
        />
        <div className="flex gap-2 flex-wrap">
          {['all', ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={`badge-pill capitalize ${filter === s ? 'bg-ink text-paper border-ink' : ''}`}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink/45 tabular-nums ml-auto">
          {filtered.length} {filtered.length === 1 ? 'order' : 'orders'} · ${revenue.toFixed(2)}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-11" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {rows.length === 0 ? 'No orders yet — they appear here the moment a customer checks out via WhatsApp.' : 'No orders match this search or filter.'}
        </div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="table-head-row">
              <th className="py-3">Order</th><th>Items</th><th>Subtotal</th><th>Status</th><th>Date</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <Fragment key={r.id}>
                <tr className="table-row align-top">
                  <td className="py-3 font-mono text-xs">{r.order_number}</td>
                  <td className="text-xs max-w-xs">
                    {(r.items || []).map((it, i) => (
                      <div key={i}>
                        {it.name}
                        {(it.color || it.size) && <span className="text-ink/50"> — {[it.color, it.size].filter(Boolean).join(' / ')}</span>}
                        <span className="text-ink/50"> × {it.quantity}</span>
                      </div>
                    ))}
                  </td>
                  <td className="tabular-nums">${r.subtotal}</td>
                  <td>
                    <select
                      value={r.status}
                      onChange={(e) => setStatus(r.id, e.target.value)}
                      aria-label={`Status for ${r.order_number}`}
                      className="border border-ink/20 px-2 py-1.5 text-xs bg-transparent capitalize focus:outline-none focus:border-ink transition-colors"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="text-xs text-ink/50 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="text-right">
                    <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="btn-link">
                      {expanded === r.id ? 'Hide' : 'Notes'}
                    </button>
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr className="border-b border-ink/5">
                    <td colSpan={6} className="py-4 bg-paper/50 px-3">
                      <label className="field-label">Internal Notes</label>
                      <textarea
                        defaultValue={r.notes || ''}
                        onBlur={(e) => { if (e.target.value !== (r.notes || '')) updateNotes(r.id, e.target.value); }}
                        rows={2}
                        className="field-input"
                      />
                      {r.whatsapp_message && (
                        <>
                          <div className="field-label mt-4">Message Sent</div>
                          <pre className="text-xs text-ink/60 whitespace-pre-wrap font-body">{r.whatsapp_message}</pre>
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// RFC 4180: wrap in quotes, double any embedded quote. A leading =, +, - or @
// is prefixed with an apostrophe so spreadsheets don't execute it as a formula.
function csvCell(value) {
  const s = String(value ?? '');
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}
