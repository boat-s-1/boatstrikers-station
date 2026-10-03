import Link from 'next/link';
import BlogShell from '../BlogShell';
import {loadPublicBlogIndex} from '../../../lib/blog/publicServer';
import {pageMetadata,archiveHref} from '../../../lib/blog/seo.mjs';
import s from '../blog.module.css';
export const dynamic='force-dynamic';
export const metadata=pageMetadata({title:'タグ一覧｜BOATSTRIKERS BLOG',path:'/blog/tags',description:'公開記事のテーマから、読みたい記事を探せます。',noindex:true,env:process.env.VERCEL_ENV});
export default async function TagsPage(){
 const index=await loadPublicBlogIndex();
 const used=new Set(index.posts.flatMap(p=>(p.revision.blog_post_tags||[]).map(t=>t.tag_id)));
 const tags=index.tags.filter(t=>used.has(t.id));
 return <BlogShell><main className={s.main}><section className={s.categories}><h1>タグ一覧</h1><p>公開記事のテーマから探す。</p>{tags.length?<div className={s.chips}>{tags.map(t=><Link key={t.id} href={archiveHref('tags',t.slug)}>{t.name}</Link>)}</div>:<p className={s.smallEmpty}>公開記事のタグは、記事公開後にご紹介します。</p>}<Link href="/blog">BLOGトップへ →</Link></section></main></BlogShell>;
}
