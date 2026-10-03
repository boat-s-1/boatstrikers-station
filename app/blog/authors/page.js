import Link from 'next/link';
import BlogShell from '../BlogShell';
import { BLOG_AUTHORS } from '../../../lib/blog/catalogue.mjs';
import { pageMetadata,authorIdentity,archiveHref } from '../../../lib/blog/seo.mjs';
import s from '../blog.module.css';
export const metadata=pageMetadata({title:'著者一覧｜BOATSTRIKERS BLOG',path:'/blog/authors',description:'一果・初音・キイナはBoatStrikersの編集キャラクター。3人と編集部が、それぞれの担当分野から読み物を届けます。',env:process.env.VERCEL_ENV});
export default function AuthorsPage(){return <BlogShell><main className={s.main}><section className={s.authors}><span className={s.eyebrow}>MEET THE AUTHORS</span><h1>著者一覧</h1><div className={s.authorGrid}>{BLOG_AUTHORS.map(a=><Link className={s.article} href={archiveHref('authors',a.slug)} key={a.slug}><h2>{a.name}</h2><strong>{a.role}</strong><p>{authorIdentity(a)}</p><p>{a.bio}</p><span>この著者の記事一覧 →</span></Link>)}</div></section></main></BlogShell>}
