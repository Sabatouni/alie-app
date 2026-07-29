import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const SettingsContext = createContext(null);

// Every storefront surface that used to hardcode brand copy reads from here.
// One query on mount instead of the per-page `select brand` each page was doing.
//
// Defaults exist so the site renders sensibly on a fresh database, but they are
// deliberately structural (empty strings, empty arrays) rather than marketing
// copy — nothing here should ever be words a visitor sees unless an admin typed
// them. The one exception is the brand name, which falls back to "ALIÈ" so the
// header is never blank.

const DEFAULTS = {
  brand: { name: 'ALIÈ', founded_in: '', whatsapp_number: '', email: '', logo_url: '', tagline: '' },
  social: { instagram: '', whatsapp: '', pinterest: '' },
  footer: { blurb: '', copyright: '', columns: [] },
  seo: { title: '', description: '' },
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('alie_site_settings').select('key, value');
    if (error) {
      console.warn('[SettingsContext] load failed:', error);
      setLoading(false);
      return;
    }
    const byKey = Object.fromEntries((data || []).map((row) => [row.key, row.value || {}]));
    setSettings({
      brand: { ...DEFAULTS.brand, ...byKey.brand },
      social: { ...DEFAULTS.social, ...byKey.social },
      footer: { ...DEFAULTS.footer, ...byKey.footer },
      seo: { ...DEFAULTS.seo, ...byKey.seo },
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const value = useMemo(
    () => ({ ...settings, loading, reloadSettings: load }),
    [settings, loading, load]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext) ?? { ...DEFAULTS, loading: true, reloadSettings: () => {} };

export { DEFAULTS as SETTINGS_DEFAULTS };
