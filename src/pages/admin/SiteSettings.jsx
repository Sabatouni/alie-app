import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';
import { useSettings, SETTINGS_DEFAULTS } from '../../context/SettingsContext';
import ImageField from '../../components/admin/ImageField';

// Everything the Nav and Footer render now comes from here. Saving reloads the
// SettingsContext, so the live site updates without a page refresh.
//
// Rows are upserted on `key` rather than updated, so the footer and seo keys are
// created on first save instead of failing silently against a missing row.

export default function SiteSettings() {
  const toast = useToast();
  const { reloadSettings } = useSettings();
  const [brand, setBrand] = useState(SETTINGS_DEFAULTS.brand);
  const [social, setSocial] = useState(SETTINGS_DEFAULTS.social);
  const [footer, setFooter] = useState(SETTINGS_DEFAULTS.footer);
  const [seo, setSeo] = useState(SETTINGS_DEFAULTS.seo);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('alie_site_settings').select('key, value');
      const byKey = Object.fromEntries((data || []).map((r) => [r.key, r.value || {}]));
      setBrand({ ...SETTINGS_DEFAULTS.brand, ...byKey.brand });
      setSocial({ ...SETTINGS_DEFAULTS.social, ...byKey.social });
      setFooter({ ...SETTINGS_DEFAULTS.footer, ...byKey.footer });
      setSeo({ ...SETTINGS_DEFAULTS.seo, ...byKey.seo });
      setLoading(false);
    }
    load();
  }, []);

  const whatsappValid = !brand.whatsapp_number || /^\d{7,15}$/.test(brand.whatsapp_number);
  const emailValid = !brand.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brand.email);

  async function save() {
    if (!whatsappValid) { toast.error('WhatsApp number should be digits only, with country code and no leading +.'); return; }
    if (!emailValid) { toast.error("That email address doesn't look right."); return; }

    setSaving(true);
    const { error } = await supabase
      .from('alie_site_settings')
      .upsert(
        [
          { key: 'brand', value: brand },
          { key: 'social', value: social },
          { key: 'footer', value: cleanFooter(footer) },
          { key: 'seo', value: seo },
        ],
        { onConflict: 'key' }
      );
    setSaving(false);
    if (error) { toast.error(error.message); return; }

    await reloadSettings(); // Nav and Footer pick the change up immediately
    toast.success('Settings saved.');
  }

  // ── Footer column editing ─────────────────────────────────────────────────

  const columns = footer.columns || [];

  function setColumns(next) {
    setFooter((f) => ({ ...f, columns: next }));
  }

  function addColumn() {
    setColumns([...columns, { title: '', links: [] }]);
  }

  function updateColumn(i, patch) {
    setColumns(columns.map((c, index) => (index === i ? { ...c, ...patch } : c)));
  }

  function moveColumn(i, delta) {
    const to = i + delta;
    if (to < 0 || to >= columns.length) return;
    const next = [...columns];
    const [moved] = next.splice(i, 1);
    next.splice(to, 0, moved);
    setColumns(next);
  }

  function addLink(colIndex) {
    const col = columns[colIndex];
    updateColumn(colIndex, { links: [...(col.links || []), { label: '', to: '' }] });
  }

  function updateLink(colIndex, linkIndex, patch) {
    const col = columns[colIndex];
    updateColumn(colIndex, {
      links: (col.links || []).map((l, i) => (i === linkIndex ? { ...l, ...patch } : l)),
    });
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="skeleton h-40" />
        <div className="skeleton h-32" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl mb-2">Site Settings</h1>
      <p className="text-sm text-ink/50 mb-8">
        The header, footer and order button all read from here. Changes apply as soon as you save.
      </p>

      <section className="card-panel mb-6">
        <h2 className="text-[11px] tracking-[0.14em] uppercase text-ink/50 mb-5">Brand</h2>
        <Field label="Brand Name" value={brand.name} onChange={(v) => setBrand({ ...brand, name: v })} />
        <Field label="Tagline" value={brand.tagline} onChange={(v) => setBrand({ ...brand, tagline: v })} hint="Used as the default meta description." />
        <Field label="Founded In" value={brand.founded_in} onChange={(v) => setBrand({ ...brand, founded_in: v })} />
        <div className="mb-4">
          <label className="field-label">Contact Email</label>
          <input
            type="email"
            value={brand.email || ''}
            onChange={(e) => setBrand({ ...brand, email: e.target.value })}
            className="field-input"
          />
          {!emailValid && <p className="text-[11px] text-red-700 mt-1.5">That doesn't look like an email address.</p>}
          <p className="text-[11px] text-ink/40 mt-1.5">Shown in the footer as a mailto link. Leave blank to hide it.</p>
        </div>
        <div className="mb-4">
          <label className="field-label">WhatsApp Order Number</label>
          <input
            value={brand.whatsapp_number || ''}
            onChange={(e) => setBrand({ ...brand, whatsapp_number: e.target.value.replace(/[^\d]/g, '') })}
            placeholder="e.g. 255700000000"
            className="field-input"
          />
          <p className="text-[11px] text-ink/40 mt-1.5">
            Country code, digits only, no + or spaces. Without this, the Order button on every product shows an error.
          </p>
        </div>
        <ImageField
          label="Logo"
          value={brand.logo_url}
          onChange={(v) => setBrand({ ...brand, logo_url: v })}
          aspect="aspect-square"
          hint="Optional. Replaces the default mark in the header and footer."
        />
      </section>

      <section className="card-panel mb-6">
        <h2 className="text-[11px] tracking-[0.14em] uppercase text-ink/50 mb-5">Social Links</h2>
        <p className="text-[11px] text-ink/40 mb-4">Full URLs. Anything left blank is hidden from the footer.</p>
        <Field label="Instagram" value={social.instagram} onChange={(v) => setSocial({ ...social, instagram: v })} placeholder="https://instagram.com/…" />
        <Field label="WhatsApp" value={social.whatsapp} onChange={(v) => setSocial({ ...social, whatsapp: v })} placeholder="https://wa.me/…" />
        <Field label="Pinterest" value={social.pinterest} onChange={(v) => setSocial({ ...social, pinterest: v })} placeholder="https://pinterest.com/…" last />
      </section>

      <section className="card-panel mb-6">
        <h2 className="text-[11px] tracking-[0.14em] uppercase text-ink/50 mb-5">Footer</h2>
        <div className="mb-4">
          <label className="field-label">Blurb</label>
          <textarea
            value={footer.blurb || ''}
            onChange={(e) => setFooter({ ...footer, blurb: e.target.value })}
            rows={2}
            className="field-input"
          />
        </div>
        <Field
          label="Copyright Line"
          value={footer.copyright}
          onChange={(v) => setFooter({ ...footer, copyright: v })}
          placeholder="© {year} ALIÈ. All rights reserved."
          hint="{year} is replaced with the current year. Blank falls back to © year + brand name."
        />

        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <label className="field-label mb-0">Link Columns</label>
            <button type="button" onClick={addColumn} className="btn-link">Add column</button>
          </div>

          {columns.length === 0 ? (
            <p className="text-sm text-ink/45">No columns — the footer shows the brand block only.</p>
          ) : (
            <div className="space-y-4">
              {columns.map((col, i) => (
                <div key={i} className="border border-ink/10 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      value={col.title || ''}
                      onChange={(e) => updateColumn(i, { title: e.target.value })}
                      placeholder="Column heading"
                      aria-label={`Column ${i + 1} heading`}
                      className="field-input py-1.5 text-sm flex-1"
                    />
                    <button type="button" onClick={() => moveColumn(i, -1)} disabled={i === 0} aria-label="Move column left" className="disabled:opacity-25 px-1">←</button>
                    <button type="button" onClick={() => moveColumn(i, 1)} disabled={i === columns.length - 1} aria-label="Move column right" className="disabled:opacity-25 px-1">→</button>
                    <button type="button" onClick={() => setColumns(columns.filter((_, index) => index !== i))} className="btn-link-danger">Remove</button>
                  </div>

                  {(col.links || []).map((link, li) => (
                    <div key={li} className="flex gap-2 mb-2">
                      <input
                        value={link.label || ''}
                        onChange={(e) => updateLink(i, li, { label: e.target.value })}
                        placeholder="Label"
                        aria-label="Link label"
                        className="field-input py-1.5 text-xs flex-1"
                      />
                      <input
                        value={link.to || ''}
                        onChange={(e) => updateLink(i, li, { to: e.target.value })}
                        placeholder="/collections or https://…"
                        aria-label="Link target"
                        className="field-input py-1.5 text-xs flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => updateColumn(i, { links: col.links.filter((_, index) => index !== li) })}
                        aria-label="Remove link"
                        className="btn-link-danger px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addLink(i)} className="btn-link mt-1">Add link</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card-panel mb-8">
        <h2 className="text-[11px] tracking-[0.14em] uppercase text-ink/50 mb-5">Search Engines</h2>
        <Field label="Homepage Title" value={seo.title} onChange={(v) => setSeo({ ...seo, title: v })} hint="Falls back to the brand name." />
        <div>
          <label className="field-label">Homepage Description</label>
          <textarea
            value={seo.description || ''}
            onChange={(e) => setSeo({ ...seo, description: e.target.value })}
            rows={2}
            className="field-input"
          />
          <p className="text-[11px] text-ink/40 mt-1.5">Falls back to the tagline.</p>
        </div>
      </section>

      <button onClick={save} disabled={saving} className="btn-primary">
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}

// Drop half-finished rows so the footer never renders an empty heading or a
// link with no destination.
function cleanFooter(footer) {
  return {
    ...footer,
    columns: (footer.columns || [])
      .map((c) => ({ ...c, links: (c.links || []).filter((l) => l.label?.trim() && l.to?.trim()) }))
      .filter((c) => c.title?.trim()),
  };
}

function Field({ label, value, onChange, last, hint, ...rest }) {
  return (
    <div className={last ? '' : 'mb-4'}>
      <label className="field-label">{label}</label>
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} className="field-input" {...rest} />
      {hint && <p className="text-[11px] text-ink/40 mt-1.5">{hint}</p>}
    </div>
  );
}
