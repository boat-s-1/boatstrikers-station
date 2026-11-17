import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { isPublicThread } from '../../../../lib/community/catalogue.mjs';
import styles from '../../community.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: true } };
async function loadThread(slug) {
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(slug)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data, error } = await client.from('community_threads')
    .select('slug,title,excerpt,body,status,audience,published_at,character_key')
    .eq('slug', slug).eq('status', 'published').eq('audience', 'public')
    .lte('published_at', new Date().toISOString()).maybeSingle();
    if (error || !isPublicThread(data)) return null;
    return data;
  } catch {
    // An unavailable database must never expose a partially resolved thread.
    return null;
  }
}
export default async function CommunityThreadPage({ params }) {
  const { slug } = await params;
  const thread = await loadThread(slug);
  if (!thread) notFound();
  return <main className={styles.main}>
    <Link href="/community" className={styles.back}>掲示板トップへ</Link>
    <div className={styles.kicker}>OFFICIAL THREAD</div>
    <h1>{thread.title}</h1>
    {thread.excerpt && <p className={styles.intro}>{thread.excerpt}</p>}
    <article style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>{thread.body}</article>
    <p className={styles.note}>会員返信機能は準備中です。</p>
  </main>;
}
