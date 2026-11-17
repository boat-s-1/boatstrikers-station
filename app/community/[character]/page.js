import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COMMUNITY_CHARACTERS } from '../../../lib/community/catalogue.mjs';
import { loadPublicCommunityThreads } from '../../../lib/community/publicServer';
import styles from '../community.module.css';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }) {
  const { character } = await params;
  const c = COMMUNITY_CHARACTERS.find(item => item.key === character);
  if (!c) return {};
  return { title: `${c.name}の掲示板｜BoatStrikers`, robots: { index: false, follow: true } };
}
export default async function CharacterCommunityPage({ params }) {
  const { character } = await params;
  const c = COMMUNITY_CHARACTERS.find(item => item.key === character);
  if (!c) notFound();
  const { threads, availability } = await loadPublicCommunityThreads({ characterKey: character, limit: 20 });
  return <main className={styles.main}>
    <Link href="/community" className={styles.back}>掲示板トップへ</Link>
    <div className={styles.kicker}>CHARACTER BOARD</div>
    <h1>{c.name}の掲示板</h1><p className={styles.intro}>{c.description}</p>
    {threads.length ? <ul className={styles.posts}>{threads.map(t =>
      <li key={t.id}><Link href={`/community/t/${encodeURIComponent(t.slug)}`}>{t.title}</Link><p>{t.excerpt}</p></li>
    )}</ul> : <p className={styles.empty} role="status">{availability === 'ready' ? '公開中の投稿はまだありません。' : '掲示板は準備中です。'}</p>}
  </main>;
}
