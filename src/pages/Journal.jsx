import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../context/SettingsContext';
import ImageSlot from '../components/ImageSlot';
import { setMeta } from '../lib/seo';

export default function Journal() {
  const { brand } = useSettings();
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMeta({
      title: `Journal — ${brand.name || 'ALIÈ'}`,
      description: 'Notes from the studio.',
    });

    Promise.all([
      supabase
        .from('alie_journal_posts')
        .select('*, journal_categories:alie_journal_categories(id, name)')
        .eq('status', 'published')
        .order('published_at', { ascending: false, nullsFirst: false }),
      supabase.from('alie_journal_categories').select('id, name').order('name'),
    ]).then(([{ data: rows }, { data: cats }]) => {
      setPosts(rows || []);
      setCategories(cats || []);
      setLoading(false);
    });
  }, [brand.name]);

  const visible = activeCategory === 'all'
    ? posts
    : posts.filter((p) => p.category_id === activeCategory);

  // Only offer a filter for categories that actually have published posts.
  const usedCategories = categories.filter((c) => posts.some((p) => p.category_id === c.id));

  return (
    <div className="pt-32 px-6 md:px-14 pb-32">
      <div className="mb-10">
        <div className="eyebrow text-camel mb-3">Journal</div>
        <h1 className="font-display text-4xl md:text-5xl">Notes from the studio</h1>
      </div>

      {usedCategories.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-12">
          <button
            onClick={() => setActiveCategory('all')}
            className={`badge-pill ${activeCategory === 'all' ? 'bg-ink text-paper border-ink' : ''}`}
          >
            All
          </button>
          {usedCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`badge-pill ${activeCategory === c.id ? 'bg-ink text-paper border-ink' : ''}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid md:grid-cols-3 gap-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-[4/5] skeleton" />
              <div className="skeleton h-3 w-20 mt-4" />
              <div className="skeleton h-5 w-4/5 mt-3" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          {posts.length === 0 ? 'No published articles yet — check back soon.' : 'Nothing in this category yet.'}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          {visible.map((post) => (
            <Link key={post.id} to={`/journal/${post.slug}`} className="group block">
              <div className="aspect-[4/5] overflow-hidden bg-stone/20">
                <div className="w-full h-full transition-transform duration-700 group-hover:scale-105">
                  <ImageSlot src={post.hero_image_url} alt={post.title} tone="sand" sizes="(max-width: 768px) 100vw, 33vw" />
                </div>
              </div>
              {post.journal_categories?.name && (
                <div className="text-[10px] tracking-[0.16em] uppercase text-camel mt-4">{post.journal_categories.name}</div>
              )}
              <h2 className="font-display text-xl mt-2 leading-snug group-hover:text-camel transition-colors duration-300">{post.title}</h2>
              {post.excerpt && <p className="text-sm text-ink/60 mt-2 leading-relaxed line-clamp-2">{post.excerpt}</p>}
              {post.reading_time && <div className="text-xs text-ink/50 mt-3">{post.reading_time} min read</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
