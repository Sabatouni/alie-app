import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

// Colours, sizes and per-variant stock — the part of the catalogue that used to
// require hand-written SQL against alie_product_variants.
//
// A variant is one (colour, size) pair. Admins add a colour once, list the sizes
// it comes in, and this generates the rows. Existing rows are never duplicated:
// adding a size to a colour that already has rows only creates what's missing.

const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export default function ProductVariantsPanel({ productId, productSku }) {
  const toast = useToast();
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('#9C6B3E');
  const [sizes, setSizes] = useState(['S', 'M', 'L']);
  const [customSize, setCustomSize] = useState('');

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!productId) { setVariants([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('alie_product_variants')
      .select('*')
      .eq('product_id', productId)
      .order('color_name')
      .order('size');
    if (!alive.current) return;
    if (error) toast?.error(error.message);
    setVariants(data || []);
    setLoading(false);
  }, [productId, toast]);

  useEffect(() => { load(); }, [load]);

  // Group into colour → its size rows, which is how the admin thinks about it.
  const byColor = useMemo(() => {
    const map = new Map();
    for (const v of variants) {
      if (!map.has(v.color_name)) map.set(v.color_name, { hex: v.color_hex, rows: [] });
      map.get(v.color_name).rows.push(v);
    }
    return [...map.entries()];
  }, [variants]);

  function toggleSize(size) {
    setSizes((current) => (current.includes(size) ? current.filter((s) => s !== size) : [...current, size]));
  }

  function addCustomSize() {
    const next = customSize.trim().toUpperCase();
    if (!next) return;
    setSizes((current) => (current.includes(next) ? current : [...current, next]));
    setCustomSize('');
  }

  async function addColour(e) {
    e.preventDefault();
    const name = colorName.trim();
    if (!name) { toast?.error('Give the colour a name.'); return; }
    if (!sizes.length) { toast?.error('Select at least one size.'); return; }

    // Skip pairs that already exist rather than letting the insert fail.
    const existing = new Set(
      variants.filter((v) => v.color_name.toLowerCase() === name.toLowerCase()).map((v) => v.size)
    );
    const toCreate = sizes.filter((s) => !existing.has(s));
    if (!toCreate.length) {
      toast?.error(`${name} already has every one of those sizes.`);
      return;
    }

    setBusy(true);
    const { data, error } = await supabase
      .from('alie_product_variants')
      .insert(
        toCreate.map((size) => ({
          product_id: productId,
          color_name: name,
          color_hex: colorHex,
          size,
          stock: 0,
          // SKUs are globally unique in the schema, so derive one that can't collide.
          sku: buildSku(productSku, name, size),
        }))
      )
      .select();
    setBusy(false);

    if (error) { toast?.error(error.message); return; }
    if (alive.current) {
      setVariants((list) => [...list, ...(data || [])].sort(sortVariants));
      setColorName('');
    }
    toast?.success(`Added ${toCreate.length} ${toCreate.length === 1 ? 'variant' : 'variants'}.`);
  }

  async function updateVariant(id, patch) {
    setVariants((list) => list.map((v) => (v.id === id ? { ...v, ...patch } : v)));
    const { error } = await supabase.from('alie_product_variants').update(patch).eq('id', id);
    if (error) { toast?.error(error.message); load(); }
  }

  async function updateColour(name, patch) {
    setVariants((list) => list.map((v) => (v.color_name === name ? { ...v, ...patch } : v)));
    const { error } = await supabase
      .from('alie_product_variants')
      .update(patch)
      .eq('product_id', productId)
      .eq('color_name', name);
    if (error) { toast?.error(error.message); load(); }
  }

  async function removeVariant(v) {
    const { error } = await supabase.from('alie_product_variants').delete().eq('id', v.id);
    if (error) { toast?.error(error.message); return; }
    if (alive.current) setVariants((list) => list.filter((x) => x.id !== v.id));
  }

  async function removeColour(name) {
    if (!confirm(`Remove every size of "${name}" from this product?`)) return;
    const { error } = await supabase
      .from('alie_product_variants')
      .delete()
      .eq('product_id', productId)
      .eq('color_name', name);
    if (error) { toast?.error(error.message); return; }
    if (alive.current) setVariants((list) => list.filter((v) => v.color_name !== name));
    toast?.success(`${name} removed.`);
  }

  const totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);

  if (!productId) return null;

  return (
    <section className="card-panel mb-10" aria-labelledby="product-variants-heading">
      <div className="flex items-baseline justify-between mb-1.5">
        <h2 id="product-variants-heading" className="font-display text-2xl">Colours &amp; Sizes</h2>
        <span className="text-xs text-ink/40 tabular-nums">
          {variants.length} {variants.length === 1 ? 'variant' : 'variants'} · {totalStock} in stock
        </span>
      </div>
      <p className="text-sm text-ink/50 mb-6">
        Colour swatches and size buttons on the storefront come from here. Stock is per colour and size.
      </p>

      <form onSubmit={addColour} className="border border-ink/10 p-5 bg-paper/40">
        <div className="grid md:grid-cols-[1fr_auto] gap-5 items-end">
          <div>
            <label className="field-label">Colour Name</label>
            <input
              value={colorName}
              onChange={(e) => setColorName(e.target.value)}
              placeholder="e.g. Sand"
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">Swatch</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                aria-label="Colour swatch"
                className="w-11 h-[42px] border border-ink/20 bg-transparent cursor-pointer p-1"
              />
              <input
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                aria-label="Colour hex value"
                className="field-input w-28 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label className="field-label">Sizes</label>
          <div className="flex gap-2 flex-wrap items-center">
            {[...new Set([...SIZE_PRESETS, ...sizes])].map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => toggleSize(s)}
                aria-pressed={sizes.includes(s)}
                className={`badge-pill ${sizes.includes(s) ? 'bg-ink text-paper border-ink' : ''}`}
              >
                {s}
              </button>
            ))}
            <input
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSize(); } }}
              placeholder="Other…"
              aria-label="Add a custom size"
              className="field-input w-24 py-1 text-xs"
            />
          </div>
        </div>

        <button type="submit" disabled={busy} className="btn-primary mt-5">
          {busy ? 'Adding…' : 'Add Colour'}
        </button>
      </form>

      {loading ? (
        <div className="space-y-2 mt-7">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-20" />)}
        </div>
      ) : byColor.length === 0 ? (
        <div className="empty-state mt-7">
          No colours yet — add one above. Products with no variants still sell; the storefront just
          hides the swatch and size pickers.
        </div>
      ) : (
        <div className="mt-7 space-y-5">
          {byColor.map(([name, { hex, rows }]) => (
            <div key={name} className="border border-ink/10">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-ink/10 bg-paper/40">
                <input
                  type="color"
                  value={hex || '#cccccc'}
                  onChange={(e) => updateColour(name, { color_hex: e.target.value })}
                  aria-label={`Swatch for ${name}`}
                  className="w-7 h-7 border border-ink/20 bg-transparent cursor-pointer p-0.5"
                />
                <span className="text-sm">{name}</span>
                <span className="text-xs text-ink/40 tabular-nums ml-auto">
                  {rows.reduce((s, r) => s + (r.stock || 0), 0)} in stock
                </span>
                <button type="button" onClick={() => removeColour(name)} className="btn-link-danger">
                  Remove colour
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-head-row">
                    <th className="py-2.5 pl-4">Size</th><th>Stock</th><th>SKU</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v.id} className="table-row">
                      <td className="py-2.5 pl-4 w-24">{v.size}</td>
                      <td className="w-32">
                        <input
                          type="number"
                          min="0"
                          value={v.stock ?? 0}
                          onChange={(e) => updateVariant(v.id, { stock: Math.max(0, Number(e.target.value) || 0) })}
                          aria-label={`Stock for ${name} ${v.size}`}
                          className="field-input py-1.5 text-xs w-24 tabular-nums"
                        />
                      </td>
                      <td>
                        <input
                          defaultValue={v.sku || ''}
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (next !== (v.sku || '')) updateVariant(v.id, { sku: next || null });
                          }}
                          aria-label={`SKU for ${name} ${v.size}`}
                          className="field-input py-1.5 text-xs font-mono max-w-[16rem]"
                        />
                      </td>
                      <td className="text-right pr-4">
                        <button type="button" onClick={() => removeVariant(v)} className="btn-link-danger">Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function sortVariants(a, b) {
  return a.color_name.localeCompare(b.color_name) || a.size.localeCompare(b.size);
}

function buildSku(productSku, colour, size) {
  const base = (productSku || 'ALIE').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const c = colour.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  const s = size.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Random tail because alie_product_variants.sku carries a UNIQUE constraint
  // and two products may legitimately share a base/colour/size combination.
  return `${base}-${c}-${s}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
