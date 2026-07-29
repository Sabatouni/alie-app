import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from '../context/SettingsContext';
import ImageSlot from '../components/ImageSlot';
import { setMeta } from '../lib/seo';

// The Journal index has always linked to /journal/:slug. That route did not
// exist, so every article click rendered a blank page.

export default function JournalPost() {
  const { slug } = useParams();
  const { brand } = useSettings();
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');
      const { data } = await supabase
        .from('alie_journal_posts')
        .select('*, journal_categories:alie_journal_categories(name), tags:alie_journal_post_tags(alie_journal_tags(name, slug))')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();

      if (cancelled) return;
      if (!data) { setStatus('missing'); return; }

      setPost(data);
      setStatus('ready');
      setMeta({
        title: `${data.title} — ${brand.name || 'ALIÈ'}`,
        description: data.excerpt || '',
        image: data.hero_image_url,
      });
    }

    load();
    return () => { cancelled = true; };
  }, [slug, brand.name]);

  if (status === 'loading') {
    return (
      <div className="pt-32 px-6 md:px-14 pb-32 max-w-3xl mx-auto space-y-5">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-12 w-4/5" />
        <div className="skeleton aspect-[16/9] mt-6" />
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="pt-40 px-6 pb-40 text-center">
        <div className="eyebrow text-camel mb-3">Not found</div>
        <h1 className="font-display text-4xl">This article isn't published</h1>
        <Link to="/journal" className="inline-block mt-8 text-[11px] tracking-[0.16em] uppercase border-b border-ink pb-1">
          Back to the Journal
        </Link>
      </div>
    );
  }

  const tags = (post.tags || []).map((t) => t.alie_journal_tags).filter(Boolean);

  return (
    <article className="pt-32 px-6 md:px-14 pb-32">
      <div className="max-w-3xl mx-auto">
        <div className="eyebrow text-camel mb-3">{post.journal_categories?.name || 'Journal'}</div>
        <h1 className="font-display text-4xl md:text-5xl leading-tight">{post.title}</h1>
        <div className="flex gap-4 text-xs text-ink/50 mt-5 flex-wrap">
          {post.author && <span>{post.author}</span>}
          {post.published_at && <time dateTime={post.published_at}>{new Date(post.published_at).toLocaleDateString()}</time>}
          {post.reading_time && <span>{post.reading_time} min read</span>}
        </div>
      </div>

      {post.hero_image_url && (
        <div className="aspect-[16/9] max-w-4xl mx-auto mt-12 overflow-hidden">
          <ImageSlot src={post.hero_image_url} alt={post.title} tone="sand" sizes="(max-width: 1024px) 100vw, 900px" priority />
        </div>
      )}

      <div className="max-w-2xl mx-auto mt-14">
        {post.excerpt && <p className="text-lg leading-relaxed text-ink/75 mb-8">{post.excerpt}</p>}
        {/* Body is stored as plain text from the admin textarea. Rendering it as
            text (not HTML) keeps admin input out of the XSS surface. */}
        {post.body && <div className="text-[15px] leading-[1.9] text-ink/80 whitespace-pre-line">{post.body}</div>}

        {tags.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-12 pt-8 border-t border-ink/10">
            {tags.map((t) => <span key={t.slug} className="badge-pill">{t.name}</span>)}
          </div>
        )}

        <Link to="/journal" className="inline-block mt-14 text-[11px] tracking-[0.16em] uppercase border-b border-ink pb-1">
          ← All articles
        </Link>
      </div>
    </article>
  );
}
