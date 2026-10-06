import Link from 'next/link';
import { notFound } from 'next/navigation';
import BlogShell from '../../BlogShell';
import { fixtureEnabled } from '../../../../lib/blog/articleModel.mjs';
import s from '../../blog.module.css';
import t from './trials.module.css';
export const dynamic='force-dynamic';
export const metadata={title:{absolute:'試験記事4本｜BOATSTRIKERS BLOG Preview'},description:'既存教材を再編集した4本の試験記事。公開記事ではありません。',robots:{index:false,follow:false,nocache:true}};
export default async function TrialIndex(){
 if(!fixtureEnabled({vercelEnv:process.env.VERCEL_ENV,nodeEnv:process.env.NODE_ENV}))notFound();
 const {TRIAL_ARTICLES,trialHref}=await import('../../../../lib/blog/trialArticles.mjs');
 return <BlogShell><main className={s.main}><section className={s.categories}><span className={s.eyebrow}>PHASE 10 · EDITORIAL TRIALS</span><h1 id="blog-title">3人と読む、4つの研究ノート。</h1><p>既存ガイド・DATA LABをBLOG向けに再編集した試験記事です。公開日未設定・すべてnoindex。公開一覧・検索・Sitemap・Supabaseには登録していません。</p></section><section id="articles" className={t.grid} aria-label="Preview専用の試験記事一覧">{TRIAL_ARTICLES.map(a=><article className={t.card} key={a.post.id} data-trial-slug={a.post.slug}><span className={t.category}>{a.category.name} · Preview専用</span><h2><Link href={trialHref(a.post.slug)}>{a.document.title}</Link></h2><p>{a.document.excerpt}</p><div className={t.byline}>{a.authors.map(author=><span key={author.id} className={t[author.slug]}>{author.name}</span>)}</div><Link className={t.read} href={trialHref(a.post.slug)}>試験記事を読む →</Link></article>)}</section><aside className={t.note}><h2>今回の編集方針</h2><p>既存の説明を会話と解説に組み直し、出典を各記事に記載しています。数値による実証・個別レースの予想ではありません。AI MATESは確認項目を整理し、3人が考察を伝えます。</p><Link href="/blog">公開側BLOGトップを確認する →</Link></aside></main></BlogShell>;
}
