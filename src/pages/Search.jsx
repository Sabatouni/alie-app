import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../context/SettingsContext';
import ProductCard from '../components/ProductCard';
import Reveal from '../components/Reveal';
import { setMeta } from '../lib/seo';

// The Nav has always had a search icon. It was a <button> with no handler.

const SELECT = '*, product_images:alie_product_images(*), product_variants:alie_product_variants(*), collections:alie_collections(name,slug)';

export default function Search() {
  const { brand } = useSettings();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const [input, setInput] = useState(query);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    setMeta({
      title: query ? `Search: ${query} — ${brand.name || 'ALIÈ'}` : `Search — ${brand.name || 'ALIÈ'}`,
      description: 'Search the collection.',
      noindex: true, // search result pages shouldn't be indexed
    });
  }, [query, brand.name]);

  const run = useCallback(async (q) => {
    const term = q.trim();
    if (!term) { setResults([]); setSearched(false); return; }

    setLoading(true);
    // Escape PostgREST's or() delimiters so a comma or paren in the query can't
    // break out of the filter expression.
    const safe = term.replace(/[,()\\]/g, ' ').trim();
    const { data } = await supabase
      .from('alie_products')
      .select(SELECT)
      .eq('status', 'published')
      .or(`name.ilike.%${safe}%,category.ilike.%${safe}%,description.ilike.%${safe}%,fabric.ilike.%${safe}%`)
      .order('created_at', { ascending: false })
      .limit(40);

    setResults(data || []);
    setLoading(false);
    setSearched(true);
  }, []);

  useEffect(() => { run(query); }, [query, run]);

  function submit(e) {
    e.preventDefault();
    setParams(input.trim() ? { q: input.trim() } : {});
  }

  return (
    <div className="pt-32 px-6 md:px-14 pb-32">
      <Reveal variant="rise" className="mb-10">
        <div className="eyebrow text-camel mb-3">Search</div>
        <h1 className="font-display text-4xl md:text-5xl">Find a piece</h1>
      </Reveal>

      <form onSubmit={submit} className="flex gap-3 max-w-xl mb-14">
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Linen shirt, trousers, silk…"
          aria-label="Search products"
          autoFocus
          className="field-input flex-1"
        />
        <button type="submit" className="btn-primary">Search</button>
      </form>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-9">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] skeleton" />)}
        </div>
      ) : !searched ? (
        <p className="text-sm text-ink/50">Type a product name, category or fabric to begin.</p>
      ) : results.length === 0 ? (
        <div className="empty-state">Nothing matches "{query}". Try a broader term.</div>
      ) : (
        <>
          <p className="text-xs text-ink/45 mb-8 tabular-nums">
            {results.length} {results.length === 1 ? 'result' : 'results'} for "{query}"
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-9 md:gap-y-16">
            {results.map((p, i) => (
              <Reveal key={p.id} variant="rise" delay={(i % 4) * 90}>
                <ProductCard product={p} whatsappNumber={brand.whatsapp_number} />
              </Reveal>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
