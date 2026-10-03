import Link from 'next/link';
import BlogShell from '../BlogShell';
import { BLOG_CATEGORIES } from '../../../lib/blog/catalogue.mjs';
import { pageMetadata,archiveHref } from '../../../lib/blog/seo.mjs';
import s from '../blog.module.css';
export const metadata=pageMetadata({title:'カテゴリー一覧｜BOATSTRIKERS BLOG',path:'/blog/categories',description:'初心者、イン逃げ、女子戦、穴・展開、DATA LAB、24場攻略など、読みたいテーマから記事を探せます。',env:process.env.VERCEL_ENV});
export default function CategoriesPage(){return <BlogShell><main className={s.main}><section className={s.categories}><h1>カテゴリー一覧</h1><div className={s.chips}>{BLOG_CATEGORIES.map(c=><Link href={archiveHref('categories',c.slug)} key={c.slug}>{c.name}</Link>)}</div></section></main></BlogShell>}
