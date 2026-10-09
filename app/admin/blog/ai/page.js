import Link from 'next/link';
import { blogAdminReady, blogWritesReady } from '../../../../lib/blog/adminData';
import { aiConfig } from '../../../../lib/blog/ai/config.mjs';
import { AI_CATEGORIES } from '../../../../lib/blog/ai/topics.mjs';
import { scheduleConfig } from '../../../../lib/blog/ai/schedule.mjs';
import { STADIUMS } from '../../../../lib/stadiums.js';
import AiDraftsClient from './AiDraftsClient';
import s from '../blogAdmin.module.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI下書き | BOATSTRIKERS BLOG', robots: { index: false, follow: false } };

export default function AiDraftsPage() {
  const ready = blogAdminReady(), writes = blogWritesReady(), enabled = aiConfig().enabled, schedule = scheduleConfig();
  return <main className={s.page}>
    <div className={s.editorHeader}><Link href="/admin/blog">← 記事一覧</Link></div>
    <header className={s.hero}><p className={s.eyebrow}>BOATSTRIKERS BLOG · AI DRAFTS</p><h1>AI下書き</h1>
      <p>テーマ選定 → 公式情報の取得 → AIによる下書き作成 → 表紙画像 → 下書き保存までを行います。公開は、記事ごとに内容を確認して承認した後、記事編集画面から行います。</p></header>
    {!ready ? <div className={s.notice}>BLOG検証DBが接続されていません。画面構成のみ確認できます。</div>
      : !writes ? <div className={s.notice}>BLOG書き込みは停止中です。閲覧のみ可能です。</div>
      : !enabled ? <div className={s.notice}>AI下書き機能は無効です（BLOG_AI_DRAFTS_ENABLED）。一覧の閲覧のみ可能です。</div> : null}
    <AiDraftsClient ready={ready} writable={ready && writes && enabled} stadiums={STADIUMS.map(x => ({ slug: x.slug, name: x.name }))}
      schedule={{ enabled: schedule.enabled, autoTopics: schedule.autoTopics, maxPerRun: schedule.maxPerRun, categories: schedule.categories }}
      categories={Object.entries(AI_CATEGORIES).map(([slug, c]) => ({ slug, name: c.name, perStadium: c.perStadium }))} />
  </main>;
}
