import Link from 'next/link';
import { notFound } from 'next/navigation';
import BlogShell from '../../BlogShell';
import { fixtureEnabled } from '../../../../lib/blog/articleModel.mjs';
import { articleDestinations } from '../../../../lib/blog/navigation.mjs';
import s from '../../blog.module.css';
export const dynamic='force-dynamic';
export const metadata={title:{absolute:'RACE ↔ BLOG導線確認｜BOATSTRIKERS BLOG'},robots:{index:false,follow:false}};
export default function NavigationPreview(){
 if(!fixtureEnabled({vercelEnv:process.env.VERCEL_ENV,nodeEnv:process.env.NODE_ENV}))notFound();
 const scenarios=[['一果','inside-course','ichika'],['初音','women','hatsune'],['キイナ','longshot','kiina'],['初心者','beginner','editorial'],['下関・24場攻略','stadiums','editorial']];
 return <BlogShell><main className={s.main}><section className={s.categories}><span className={s.eyebrow}>PHASE 9 · PREVIEW ONLY</span><h1>読む場所から、レースへ。</h1><p>導線の表示確認専用です。公開記事・架空記事は追加していません。各リンクは既存の実ページへ移動します。</p><Link href="/blog/preview/article">記事詳細でCTAを見る →</Link></section>{scenarios.map(([name,category,author])=><section className={s.latest} key={category}><h2>{name}の記事テーマ</h2><div className={s.chips} data-blog-placement="preview-theme-cta">{articleDestinations({category:{slug:category},authors:[{slug:author}],document:{seo:{stadium_slug:'shimonoseki'}}}).map(l=><Link href={l.href} key={l.href} prefetch={false}>{l.label} ↗</Link>)}</div></section>)}<section className={s.categories}><h2>RACEから読む場所へ</h2><p>出走表・3人の部屋・場ページの下部にBLOG入口を設置しています。対応する公開記事がある場合だけ関連記事を表示します。</p><div className={s.chips}><Link href="/races">出走表 → BLOG</Link><Link href="/library/stadium/shimonoseki">下関 → BLOG</Link><Link href="/blog">BLOGトップ</Link></div></section></main></BlogShell>;
}
