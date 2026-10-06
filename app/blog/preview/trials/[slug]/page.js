import Link from 'next/link';
import { notFound } from 'next/navigation';
import ArticleDetail from '../../../ArticleDetail';
import { fixtureEnabled } from '../../../../../lib/blog/articleModel.mjs';
import t from '../trials.module.css';
export const dynamic='force-dynamic';
const enabled=()=>fixtureEnabled({vercelEnv:process.env.VERCEL_ENV,nodeEnv:process.env.NODE_ENV});
export async function generateMetadata({params}){
 if(!enabled())notFound();
 const {getTrialArticle}=await import('../../../../../lib/blog/trialArticles.mjs');
 const article=getTrialArticle((await params).slug);if(!article)notFound();
 return {title:{absolute:`${article.document.title.replace(/\n/g,' ')}｜Preview`},description:article.document.excerpt,robots:{index:false,follow:false,nocache:true}};
}
export default async function TrialDetail({params}){
 if(!enabled())notFound();
 const {TRIAL_ARTICLES,getTrialArticle,trialHref}=await import('../../../../../lib/blog/trialArticles.mjs');
 const article=getTrialArticle((await params).slug);if(!article)notFound();
 return <ArticleDetail article={article} preview="trial"><aside className={t.note}><h2>他の試験記事も読む</h2><p>以下はすべてPreview専用です。公開記事の関連記事には混ぜていません。</p><ul className={t.related}>{TRIAL_ARTICLES.filter(a=>a.post.slug!==article.post.slug).map(a=><li key={a.post.id}><Link href={trialHref(a.post.slug)}>{a.document.title.replace(/\n/g,' ')} →</Link></li>)}</ul><Link href="/blog/preview/trials">試験記事4本の一覧へ戻る →</Link></aside></ArticleDetail>;
}
