import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../context/ToastContext';

export default function SiteSettings() {
  const toast = useToast();
  const [brand, setBrand] = useState({ name: 'ALIÈ', founded_in: 'Zanzibar', whatsapp_number: '' });
  const [social, setSocial] = useState({ instagram: '', whatsapp: '', pinterest: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: b }, { data: s }] = await Promise.all([
        supabase.from('alie_site_settings').select('*').eq('key', 'brand').single(),
        supabase.from('alie_site_settings').select('*').eq('key', 'social').single(),
      ]);
      if (b?.value) setBrand(b.value);
      if (s?.value) setSocial(s.value);
      setLoading(false);
    }
    load();
  }, []);

  const whatsappLooksValid = !brand.whatsapp_number || /^\d{7,15}$/.test(brand.whatsapp_number);

  async function save() {
    if (!whatsappLooksValid) {
      toast.error('WhatsApp number should be digits only, with country code and no leading +.');
      return;
    }
    setSaving(true);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('alie_site_settings').update({ value: brand }).eq('key', 'brand'),
      supabase.from('alie_site_settings').update({ value: social }).eq('key', 'social'),
    ]);
    setSaving(false);
    if (e1 || e2) { toast.error((e1 || e2).message); return; }
    toast.success('Settings saved.');
  }

  if (loading) {
    return (
      <div className="max-w-xl space-y-6">
        <div className="skeleton h-40" />
        <div className="skeleton h-32" />
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl mb-8">Site Settings</h1>

      <div className="card-panel mb-6">
        <h2 className="text-[11px] tracking-[0.14em] uppercase text-ink/50 mb-5">Brand</h2>
        <Field label="Brand Name" value={brand.name} onChange={(v) => setBrand({ ...brand, name: v })} />
        <Field label="Founded In" value={brand.founded_in} onChange={(v) => setBrand({ ...brand, founded_in: v })} />
        <div className="mb-1">
          <label className="field-label">WhatsApp Order Number</label>
          <input
            value={brand.whatsapp_number || ''}
            onChange={(e) => setBrand({ ...brand, whatsapp_number: e.target.value.replace(/[^\d]/g, '') })}
            placeholder="e.g. 255700000000"
            className="field-input"
          />
          <p className="text-[11px] text-ink/40 mt-1.5">Country code, digits only, no + or spaces.</p>
        </div>
      </div>

      <div className="card-panel mb-8">
        <h2 className="text-[11px] tracking-[0.14em] uppercase text-ink/50 mb-5">Social Links</h2>
        <Field label="Instagram" value={social.instagram} onChange={(v) => setSocial({ ...social, instagram: v })} />
        <Field label="WhatsApp" value={social.whatsapp} onChange={(v) => setSocial({ ...social, whatsapp: v })} />
        <Field label="Pinterest" value={social.pinterest} onChange={(v) => setSocial({ ...social, pinterest: v })} last />
      </div>

      <button onClick={save} disabled={saving} className="btn-primary">
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, last }) {
  return (
    <div className={last ? '' : 'mb-4'}>
      <label className="field-label">{label}</label>
      <input value={value || ''} onChange={(e) => onChange(e.target.value)} className="field-input" />
    </div>
  );
}
