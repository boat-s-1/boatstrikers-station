import Link from 'next/link';
import Image from 'next/image';
import { loadPublicBlogIndex } from '../../lib/blog/publicServer';
import { indexFilters, selectIndex } from '../../lib/blog/publicIndex.mjs';
import { BLOG_AUTHORS, BLOG_CATEGORIES } from '../../lib/blog/catalogue.mjs';
import s from './blog.module.css';
import BlogShell from './BlogShell';
import { blogIndexMetadata, archiveHref, authorIdentity } from '../../lib/blog/seo.mjs';
import { articleHref } from '../../lib/blog/articleModel.mjs';

export const dynamic = 'force-dynamic';
export async function generateMetadata({searchParams}) {
  return blogIndexMetadata(await searchParams || {}, process.env.VERCEL_ENV);
}
function url(filters, change = {}) {
  const values = { ...filters, page: 1, ...change };
  const query = new URLSearchParams(Object.entries(values).filter(([k,v]) => v && !(k === 'page' && v === 1)));
  return `/blog${query.size ? `?${query}` : ''}#articles`;
}
function date(value) { return new Intl.DateTimeFormat('ja-JP', { timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(value)); }
function Empty({ title, children }) { return <div className={s.empty}><span className={s.emptyMark} aria-hidden="true">＋</span><div><h3>{title}</h3><p>{children}</p></div></div>; }
function Heading({ label, title, children, id }) { return <div className={s.sectionHeading} id={id}><div><span className={s.eyebrow}>{label}</span><h2>{title}</h2></div>{children}</div>; }
function Articles({ posts, index }) {
  return <div className={s.articleGrid}>{posts.map(p => {
    const r = p.revision;
    const category = index.categories.find(c => c.id === r.category_id);
    const names = [...r.blog_post_authors].sort((a,b)=>a.position-b.position).map(a => index.authors.find(x=>x.id===a.author_id)?.name).filter(Boolean);
    return <article className={s.article} key={p.id}>
      <div className={s.articleTop}><span>{category?.name || '読み物'}</span><time dateTime={p.first_published_at}>{date(p.first_published_at)}</time></div>
      <h3><Link href={articleHref(p.slug)}>{r.title}</Link></h3><p>{r.excerpt}</p><div className={s.articleFoot}><span>{names.join(' / ')}</span><Link href={articleHref(p.slug)}>記事を読む →</Link></div>
    </article>;
  })}</div>;
}
export default async function BlogPage({ searchParams }) {
  const filters = indexFilters(await searchParams);
  const index = await loadPublicBlogIndex();
  const view = selectIndex(index, filters, (process.env.BLOG_FEATURED_SLUGS || '').split(',').map(s=>s.trim()).filter(Boolean));
  const categories = index.availability === 'ready' ? index.categories : BLOG_CATEGORIES;
  const authors = index.availability === 'ready' ? index.authors : BLOG_AUTHORS;
  const filtering = Boolean(filters.q || filters.category || filters.author || filters.tag);
  return <BlogShell>
    <main className={s.main}>
      <section className={s.hero} aria-labelledby="blog-title">
        <div><span className={s.eyebrow}>THE BOAT RACE READING ROOM</span><h1 id="blog-title">ボートレースを、<br/>もっと<span>読み解こう。</span></h1><p className={s.lead}>知ると、レースの見え方が変わる。<br/>一果・初音・キイナと編集部が届ける、<br className={s.mobileBreak}/>ボートレースの読み物メディア。</p>
          <form className={s.search} action="/blog" role="search"><label className={s.srOnly} htmlFor="blog-search">記事のタイトル・紹介文を検索</label><input id="blog-search" type="search" name="q" placeholder="気になるテーマを検索" defaultValue={filters.q} maxLength={100}/><button type="submit">検索 <span aria-hidden="true">↗</span></button></form>
          <p className={s.searchHint}>イン逃げ、女子戦、展示… 知りたいことから。</p></div>
        <div className={s.heroArt} aria-hidden="true"><span className={s.artLabel}>LEARN / READ / DISCOVER</span><span className={s.artCircle}/>{BLOG_AUTHORS.filter(a=>a.image_path).map(a=><Image key={a.slug} src={a.image_path} alt="" width={160} height={210} sizes="(max-width: 760px) 28vw, 140px" className={s[a.slug]} priority/>)}<span className={s.artNote}>3人と、ひとつずつ。</span></div>
      </section>
      <section className={s.categories} id="categories"><Heading label="EXPLORE TOPICS" title="どこから読もう？"/><div className={s.chips}><Link href={url(filters,{category:''})} aria-current={!filters.category?'page':undefined}>すべて</Link>{categories.map(c=><Link key={c.slug} href={archiveHref('categories',c.slug)} aria-current={filters.category===c.slug?'page':undefined}>{c.name}</Link>)}</div></section>
      {index.availability === 'unavailable' ? <p className={s.notice} role="status">記事を読み込めませんでした。時間をおいて再度お試しください。</p> : null}
      <div className={s.editorialRow}>
        <section className={s.featured}><Heading label="EDITOR’S PICKS" title="編集部おすすめ"/>{view.featured.length ? <Articles posts={view.featured} index={index}/> : <div className={s.editorialEmpty}><span className={s.paperLabel}>FROM THE EDITORS</span><h3>「なんとなく」を、<br/>「なるほど」へ。</h3><p>基礎を知る。選手を見る。展開を考える。<br/>ひとつのテーマを深く読む場所を、ここに。</p><span className={s.preparing}>おすすめ記事は公開後にご紹介します</span></div>}</section>
        <aside className={s.readingNote}><span className={s.eyebrow}>START HERE</span><h2>初めての方へ</h2><p>最初から順番に学びたいときは、3人の会話で進む教科書へ。</p><Link href="/guide" prefetch={false}>初心者ガイドを読む <span>↗</span></Link><div className={s.noteDivider}/><p>BoatStrikersの楽しみ方と、AI MATES・3人の役割はこちら。</p><Link href="/how-to-use" prefetch={false}>サイトの使い方 <span>↗</span></Link></aside>
      </div>
      <div className={s.contentColumns}>
        <div><section className={s.latest} id="articles"><Heading label="LATEST STORIES" title={filtering?'記事を探す':'新着記事'}>{filtering?<Link className={s.clear} href="/blog#articles">条件をクリア ×</Link>:null}</Heading>
          {filtering?<div className={s.filterSummary}><p>{[filters.q && `検索：${filters.q}`,filters.category && `カテゴリー：${categories.find(c=>c.slug===filters.category)?.name || filters.category}`,filters.author && `著者：${authors.find(a=>a.slug===filters.author)?.name || filters.author}`,filters.tag && `タグ：${index.tags.find(t=>t.slug===filters.tag)?.name || filters.tag}`].filter(Boolean).join(' / ')}</p><span>{view.filtered.length}件</span></div>:null}
          {view.latest.length?<Articles posts={view.latest} index={index}/>:<Empty title={filtering?'条件に合う公開記事がありません':'最初の公開記事を準備しています'}>{filtering?'別のキーワードやテーマで探してみてください。':'公開された記事から、この場所にお届けします。'}</Empty>}
          {view.pages>1?<nav className={s.pagination} aria-label="記事一覧のページ">{view.page>1?<Link href={url(filters,{page:view.page-1})}>← 前へ</Link>:null}<span>{view.page} / {view.pages}</span>{view.page<view.pages?<Link href={url(filters,{page:view.page+1})}>次へ →</Link>:null}</nav>:null}
        </section>
        <section className={s.updated}><Heading label="REVISITED" title="更新記事"/>{view.updated.length?<Articles posts={view.updated} index={index}/>:<Empty title="情報を見直し、読み物を育てる">公開記事の内容を更新したら、こちらでお知らせします。</Empty>}</section></div>
        <aside className={s.sidebar}><section className={s.recommend}><Heading label="READ NEXT" title="おすすめ記事"/><p className={s.sidebarIntro}>人気記事の集計開始までは、編集部が選んだ記事をご案内します。</p>{view.featured.length?<Articles posts={view.featured} index={index}/>:<p className={s.smallEmpty}>公開後のおすすめをお待ちください。</p>}</section><section className={s.tags}><Heading label="KEYWORDS" title="タグから探す"/>{view.tags.length?<div className={s.chips}>{view.tags.map(t=><Link key={t.id} href={archiveHref('tags',t.slug)} aria-current={filters.tag===t.slug?'page':undefined}># {t.name}</Link>)}</div>:<p className={s.smallEmpty}>公開記事で使われたタグを表示します。</p>}</section></aside>
      </div>
      <section className={s.authors} id="authors"><Heading label="MEET THE AUTHORS" title="違う視点が、読む楽しさに。"/><p className={s.authorIntro}>得意分野の違う3人と、BoatStrikers編集部。著者から読み物を探せます。</p><div className={s.authorGrid}>{authors.map(a=><Link href={archiveHref('authors',a.slug)} key={a.slug} className={`${s.author} ${s[a.slug+'Card'] || ''}`} aria-current={filters.author===a.slug?'page':undefined}><div className={s.portrait}>{a.image_path?.startsWith('/anime/')?<Image src={a.image_path} alt={`${a.name}のキャラクター画像`} width={90} height={120} sizes="90px"/>:<span className={s.editorIcon} aria-hidden="true">BS<br/>EDITORS</span>}</div><div><span className={s.authorLabel}>AUTHOR</span><h3>{a.name}</h3><p className={s.role}>{a.role}</p><p>{a.bio}</p><small>{authorIdentity(a)}</small><span className={s.authorLink}>この著者の記事を見る →</span></div></Link>)}</div></section>
      <section className={s.raceCta}><div><span className={s.eyebrow}>READ IT. THEN WATCH IT.</span><h2>読んだら、今日のレースへ。</h2><p>学んだ視点を、出走表や3人の見解と合わせて。<br/>データを分析するAI MATES、その情報から考える3人。<br/>最後に判断するのは、あなたです。</p></div><div className={s.raceLinks}><Link className={s.primaryCta} href="/today" prefetch={false}>今日のレースを見る ↗</Link><div><Link href="/ichika" prefetch={false}>一果の部屋</Link><Link href="/hatsune" prefetch={false}>初音の部屋</Link><Link href="/kiina" prefetch={false}>キイナの部屋</Link></div><Link href="/" prefetch={false}>BoatStrikers本体へ →</Link></div></section>
    </main>
  </BlogShell>;
}
