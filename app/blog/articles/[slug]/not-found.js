import Link from 'next/link';
import BlogShell from '../../BlogShell';
import s from '../../article.module.css';
export default function ArticleNotFound() {return <BlogShell article><main className={s.main}><section className={s.notFound}><span className={s.kicker}>BOATSTRIKERS BLOG</span><h1 id="article-title">記事が見つかりません</h1><p>公開された記事をBLOGトップから探してみてください。</p><Link href="/blog">BLOGトップへ →</Link></section></main></BlogShell>;}
