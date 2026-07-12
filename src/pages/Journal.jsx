import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import ImageSlot from '../components/ImageSlot';

export default function Journal() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('alie_journal_posts')
      .select('*, journal_categories:alie_journal_categories(name)')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        setPosts(data || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="pt-32 px-6 md:px-14 pb-32">
      <div className="mb-14">
        <div className="eyebrow text-camel mb-3">Journal</div>
        <h1 className="font-display text-4xl md:text-5xl">Notes from the studio</h1>
      </div>
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
      ) : posts.length === 0 ? (
        <div className="empty-state">No published articles yet — check back soon.</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link key={post.id} to={`/journal/${post.slug}`} className="group block">
              <div className="aspect-[4/5] overflow-hidden">
                <div className="w-full h-full transition-transform duration-700 group-hover:scale-105">
                  <ImageSlot src={post.hero_image_url} tone="sand" />
                </div>
              </div>
              <div className="text-[10px] tracking-[0.16em] uppercase text-camel mt-4">{post.journal_categories?.name}</div>
              <h3 className="font-display text-xl mt-2 leading-snug group-hover:text-camel transition-colors duration-300">{post.title}</h3>
              <div className="text-xs text-ink/50 mt-3">{post.reading_time} min read</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
