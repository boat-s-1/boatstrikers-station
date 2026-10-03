import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import BlogShell from '../../BlogShell';
import { fixtureEnabled } from '../../../../lib/blog/articleModel.mjs';
import { loadPublicBlogIndex } from '../../../../lib/blog/publicServer';
import { blogIndexMetadata,articleMetadata,articleStructuredData,blogSitemapEntries } from '../../../../lib/blog/seo.mjs';
import s from '../../blog.module.css';
export const dynamic='force-dynamic';
export const metadata={title:{absolute:'SEO確認｜BOATSTRIKERS BLOG'},robots:{index:false,follow:false,nocache:true}};
export default async function SeoPreviewPage(){
  if(!fixtureEnabled({vercelEnv:process.env.VERCEL_ENV,nodeEnv:process.env.NODE_ENV}))notFound();
  const {BLOG_ARTICLE_FIXTURE}=await import('../../../../lib/blog/previewFixture.mjs');
  const index=await loadPublicBlogIndex();
  const top=blogIndexMetadata({},process.env.VERCEL_ENV);
  const fixture=articleMetadata(BLOG_ARTICLE_FIXTURE,{preview:true,env:process.env.VERCEL_ENV});
  const sitemap=blogSitemapEntries(index,{env:process.env.VERCEL_ENV});
  return <BlogShell><main className={s.main}><section className={s.categories}><span className={s.eyebrow}>PHASE 8 · PREVIEW ONLY</span><h1>BLOG SEO確認</h1><p>このページは検証専用です。公開記事や実データは追加していません。</p></section>
    <section className={s.latest}><h2>公開条件と検索への露出</h2><ul><li>取得できた公開snapshot：{index.posts.length}件</li><li>この環境のBLOG Sitemap URL：{sitemap.length}件（Previewは全件除外）</li><li>検索結果・Preview・下書きはnoindex</li><li>タグは編集部のindex許可、独自説明80文字以上、index対象の公開記事5件以上が必要</li><li>キャラクター著者はBoatStrikersの編集キャラクターとして表示</li><li>ニュースカテゴリーもBlogPostingを使用。NewsArticleへの自動変換は行いません</li></ul></section>
    <section className={s.updated}><h2>OGP共通画像</h2><Image src="/blog/og" alt="BOATSTRIKERS BLOGの共通OGP画像" width={1200} height={630} unoptimized style={{width:'100%',height:'auto'}}/><p>記事指定画像 → 公開アイキャッチ → この共通画像の順に使用します。</p></section>
    <section className={s.latest}><h2>実際のmetadata生成結果</h2>{[['BLOGトップ',top],['表示確認用記事（公開日なし・noindex）',fixture],['fixtureの構造化データ（出力なし）',articleStructuredData(BLOG_ARTICLE_FIXTURE,{preview:true,env:process.env.VERCEL_ENV})]].map(([title,data])=><details key={title}><summary>{title}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:12,maxWidth:'100%'}}>{JSON.stringify(data,null,2)}</pre></details>)}</section>
    <section className={s.categories}><h2>表示を確認する</h2><div className={s.chips}><Link href="/blog">BLOGトップ</Link><Link href="/blog/preview/article">記事詳細fixture</Link><Link href="/blog/categories/beginner">初心者カテゴリー</Link><Link href="/blog/authors">著者一覧</Link><Link href="/blog/authors/ichika">一果の記事一覧</Link><Link href="/blog?q=展示">検索結果</Link></div></section>
  </main></BlogShell>;
}
