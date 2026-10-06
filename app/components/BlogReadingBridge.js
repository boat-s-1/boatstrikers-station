import Link from 'next/link';
import { Suspense } from 'react';
import { loadPublicBlogIndex } from '../../lib/blog/publicServer';
import { readingDestination, relatedPublicPosts } from '../../lib/blog/navigation.mjs';
import { articleHref } from '../../lib/blog/articleModel.mjs';
import s from './blogNavigation.module.css';
async function Related({context}) {
 const index=await loadPublicBlogIndex();const posts=relatedPublicPosts(index,context);
 if(!posts.length)return null;
 return <ul className={s.related}>{posts.map(p=><li key={p.id}><Link href={articleHref(p.slug)}><strong>{p.revision.title}</strong>{p.revision.excerpt?<span>{p.revision.excerpt}</span>:null}<small>記事を読む →</small></Link></li>)}</ul>;
}
export default function BlogReadingBridge({character,stadium}) {
 const context={character,stadium};const destination=readingDestination(context);
 return <aside className={s.bridge} aria-label="BLOGで学ぶ" data-blog-placement="race-reading-bridge"><span className={s.kicker}>BOATSTRIKERS BLOG</span><h2>見る楽しさに、読む楽しさを。</h2><Link className={s.directory} href={destination.href}>{destination.label} →</Link><Suspense fallback={null}><Related context={context}/></Suspense></aside>;
}
