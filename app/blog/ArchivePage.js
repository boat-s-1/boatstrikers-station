import Link from 'next/link';
import { notFound } from 'next/navigation';
import BlogShell from './BlogShell';
import { loadPublicBlogIndex } from '../../lib/blog/publicServer';
import { BLOG_AUTHORS, BLOG_CATEGORIES } from '../../lib/blog/catalogue.mjs';
import { archiveHref, pageMetadata, authorIdentity, tagIndexable, TAG_SEO, indexablePost } from '../../lib/blog/seo.mjs';
import { articleHref } from '../../lib/blog/articleModel.mjs';
import { indexFilters, selectIndex } from '../../lib/blog/publicIndex.mjs';
import s from './blog.module.css';

async function context(kind,slug,params={}) {
  const index=await loadPublicBlogIndex();
  const catalogue=kind==='categories'?(index.availability==='ready'?index.categories:BLOG_CATEGORIES)
    :kind==='authors'?(index.availability==='ready'?index.authors:BLOG_AUTHORS):index.tags;
  const item=catalogue.find(x=>x.slug===slug);
  if(!item) return null;
  const field={categories:'category',authors:'author',tags:'tag'}[kind];
  const view=selectIndex(index,indexFilters({...params,[field]:slug}));
  const description=kind==='authors'?`${authorIdentity(item)} ${item.bio||''}`
    :kind==='tags'?(TAG_SEO[item.slug]?.description||`「${item.name}」をテーマにしたBOATSTRIKERS BLOGの公開記事を探せます。`)
    :item.description||`「${item.name}」をテーマに、ボートレースを調べる・学ぶ・読む。3人と編集部の視点から解説します。`;
  const indexable=kind==='tags'?tagIndexable(item,index.posts):view.filtered.some(p=>indexablePost(p));
  return {index,item,view,description,indexable};
}
export async function archiveMetadata(kind,slug,params={}) {
  const c=await context(kind,slug,params);
  if(!c)return pageMetadata({title:'ページが見つかりません｜BOATSTRIKERS BLOG',noindex:true,env:process.env.VERCEL_ENV});
  return pageMetadata({title:`${c.item.name}の記事一覧｜BOATSTRIKERS BLOG`,description:c.description,path:archiveHref(kind,slug),
    noindex:!c.indexable||Object.keys(params).length>0,env:process.env.VERCEL_ENV});
}
export default async function ArchivePage({kind,slug,params={}}) {
  const c=await context(kind,slug,params);if(!c)notFound();
  const {index,item,view,description}=c;
  return <BlogShell><main className={s.main}><section className={s.categories}>
    <p><Link href="/blog">BLOG</Link> / {kind==='authors'?'著者':kind==='tags'?'タグ':'カテゴリー'}</p>
    <span className={s.eyebrow}>{kind==='authors'?'FROM THE AUTHOR':'EXPLORE TOPICS'}</span><h1>{item.name}</h1><p>{description}</p>
    {kind==='authors'?<p>{item.role}</p>:null}
  </section><section className={s.latest} id="articles"><div className={s.sectionHeading}><h2>公開記事</h2><span>{view.filtered.length}件</span></div>
    {view.latest.length?<div className={s.articleGrid}>{view.latest.map(p=><article className={s.article} key={p.id}><div className={s.articleTop}><span>{index.categories.find(x=>x.id===p.revision.category_id)?.name}</span><time dateTime={p.first_published_at}>{new Date(p.first_published_at).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'})}</time></div><h3><Link href={articleHref(p.slug)}>{p.revision.title}</Link></h3><p>{p.revision.excerpt}</p><Link href={articleHref(p.slug)}>記事を読む →</Link></article>)}</div>:<div className={s.empty}><p>このテーマの公開記事は、公開後にご紹介します。</p></div>}
    {view.pages>1?<nav className={s.pagination} aria-label="記事一覧のページ">{view.page>1?<Link href={`${archiveHref(kind,slug)}?page=${view.page-1}`}>← 前へ</Link>:null}<span>{view.page} / {view.pages}</span>{view.page<view.pages?<Link href={`${archiveHref(kind,slug)}?page=${view.page+1}`}>次へ →</Link>:null}</nav>:null}
  </section><section className={s.readingNote}><Link href="/blog">BLOGトップへ →</Link><Link href="/today">今日のレースを見る ↗</Link></section></main></BlogShell>;
}
