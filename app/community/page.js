import Link from 'next/link';
import { COMMUNITY_CHARACTERS } from '../../lib/community/catalogue.mjs';
import { loadPublicCommunityThreads } from '../../lib/community/publicServer';
import styles from './community.module.css';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '掲示板｜BoatStrikers',
  description: '一果・初音・キイナの公式レース解説と実況を探すBoatStrikers掲示板。',
  alternates: { canonical: '/community' },
  robots: { index: false, follow: true }, // Enable only after original public threads exist.
};
export default async function CommunityPage() {
  const { threads, availability } = await loadPublicCommunityThreads();
  return <main className={styles.main}>
    <div className={styles.kicker}>BOATSTRIKERS COMMUNITY</div>
    <h1>掲示板</h1>
    <p className={styles.intro}>レースの話題を、あとからも読める場所に。公式解説と実況をテーマ別にまとめます。</p>
    <nav className={styles.pillars} aria-label="サイトの主要カテゴリ">
      <Link href="/races">レース</Link><Link href="/blog">ブログ</Link><span aria-current="page">掲示板</span>
    </nav>
    <h2>キャラクター別</h2>
    <div className={styles.grid}>{COMMUNITY_CHARACTERS.map(c =>
      <Link key={c.key} className={styles.card} href={c.href}>
        <strong>{c.name}</strong><span>{c.description}</span>
      </Link>
    )}</div>
    <h2>公式の最新投稿</h2>
    {threads.length ? <ul className={styles.posts}>{threads.map(t =>
      <li key={t.id}><Link href={`/community/t/${encodeURIComponent(t.slug)}`}>{t.title}</Link><p>{t.excerpt}</p></li>
    )}</ul> : <p className={styles.empty} role="status">{availability === 'ready' ? '公開中の投稿はまだありません。' : '掲示板は準備中です。公開までお待ちください。'}</p>}
    <p className={styles.note}>投稿・返信機能は準備中です。現在、会員情報やレース予想への変更はありません。</p>
  </main>;
}
