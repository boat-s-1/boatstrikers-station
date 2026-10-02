import Image from 'next/image';
import Link from 'next/link';
import BlogShell from './BlogShell';
import { ArticleBlocks, ArticleImage, RelatedLinks } from './ArticleBlocks';
import { articleSections, themeCta } from '../../lib/blog/articleModel.mjs';
import s from './article.module.css';
function DateLabel({label,value}) {
  if(!value || !Number.isFinite(Date.parse(value))) return null;
  const date=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric'}).format(new Date(value));
  return <span>{label} <time dateTime={value}>{date}</time></span>;
}
export default function ArticleDetail({article,preview=false,children}) {
  const {post,document:doc,authors,category,tags,media,relatedPosts}=article;
  const sections=articleSections(doc.blocks),theme=themeCta(category?.slug);
  const mainRelated={post_ids:[...new Set([...doc.relations.map(r=>r.post_id).filter(Boolean),...sections.related.flatMap(b=>b.data.post_ids||[])])],
    paths:[...new Set([...doc.relations.map(r=>r.path).filter(Boolean),...sections.related.flatMap(b=>b.data.paths||[])])]};
  const props={media,relatedPosts};
  return <BlogShell article>
    <main className={s.main}>
      <nav className={s.breadcrumbs} aria-label="パンくず"><ol><li><Link href="/blog">BLOG</Link></li>{category?<li><Link href={`/blog?category=${category.slug}#articles`}>{category.name}</Link></li>:null}<li aria-current="page">{preview?'表示確認用の記事':doc.title}</li></ol></nav>
      {preview?<aside className={s.previewNotice}><strong>PREVIEW ONLY · 表示確認用</strong><p>公開記事ではありません。検索・記事一覧・Sitemap・Supabaseには登録していません。</p></aside>:null}
      <article className={s.article}>
        <header className={s.articleHeader}>
          {category?<Link className={s.category} href={`/blog?category=${category.slug}#articles`}>{category.name}</Link>:null}
          <span className={s.storyLabel}>BOATSTRIKERS BLOG · LEARNING NOTE</span>
          <h1 id="article-title">{doc.title}</h1>
          <div className={s.byline}><div className={s.bylineAuthors}>{authors.map(a=><a key={a.slug} href={`#author-${a.slug}`} className={s[a.character_key||a.slug] || ''}>{a.name}</a>)}</div>
            <div className={s.dates}>{preview?<span>公開日・更新日は未設定（Preview専用）</span>:<><DateLabel label="公開" value={post.first_published_at}/><DateLabel label="更新" value={post.last_published_at}/></>}</div>
          </div>
          {doc.excerpt?<p className={s.excerpt}>{doc.excerpt}</p>:null}
        </header>
        <ArticleImage media={media[doc.cover.media_id]} alt={doc.cover.alt} caption={doc.cover.caption} priority/>
        <section className={s.takeaways} aria-labelledby="takeaways-title"><span className={s.kicker}>BEFORE YOU READ</span><h2 id="takeaways-title">この記事で分かること</h2>{sections.takeaways.length?<ArticleBlocks blocks={sections.takeaways} {...props}/>:sections.toc.length?<ul>{sections.toc.filter(x=>x.level===2).slice(0,4).map(x=><li key={x.id}>{x.text}</li>)}</ul>:<p>{doc.excerpt}</p>}</section>
        {sections.toc.length?<details className={s.toc}><summary>目次 <span>{sections.toc.length}項目</span></summary><nav aria-label="記事の目次"><ol>{sections.toc.map(x=><li key={x.id} className={x.level===3?s.tocSub:undefined}><a href={`#${x.id}`}>{x.text}</a></li>)}</ol></nav></details>:null}
        <div className={s.body} id="article-body"><ArticleBlocks blocks={sections.body} {...props}/></div>
        {sections.ending.length?<footer className={s.endMatter}>{['summary','notes','sources'].map((placement)=>{
          const blocks=sections.ending.filter(b=>b.data.placement===placement);
          return blocks.length?<section key={placement}><h2>{placement==='summary'?'まとめ':placement==='notes'?'注意事項':'出典・参考資料'}</h2><ArticleBlocks blocks={blocks} {...props}/></section>:null;
        })}</footer>:null}
        {tags.length?<nav className={s.tags} aria-label="記事のタグ">{tags.map(t=><Link href={`/blog?tag=${t.slug}#articles`} key={t.id}># {t.name}</Link>)}</nav>:null}
      </article>
      {authors.length?<section className={s.authorProfiles}><span className={s.kicker}>ABOUT THE AUTHORS</span><h2>この記事を書いた人</h2>{authors.map(a=><div className={`${s.authorProfile} ${s[a.character_key||a.slug] || ''}`} id={`author-${a.slug}`} key={a.slug}>
        {a.image_path?.startsWith('/anime/')?<Image src={a.image_path} alt={`${a.name}のキャラクター画像`} width={74} height={96} sizes="74px"/>:<span className={s.editorIcon} aria-hidden="true">BS<br/>EDITORS</span>}
        <div><h3>{a.name}</h3><strong className={s.authorRole}>{a.role}</strong><p>{a.bio}</p><Link href={`/blog?author=${a.slug}#articles`}>この著者の記事一覧 →</Link></div>
      </div>)}</section>:null}
      <section className={s.relatedSection}><span className={s.kicker}>KEEP READING</span><h2>関連記事・関連ガイド</h2>{mainRelated.post_ids.length||mainRelated.paths.length?<RelatedLinks data={mainRelated} relatedPosts={relatedPosts} heading={false}/>:<p className={s.relatedEmpty}>あわせて読める公開記事は、今後こちらでご紹介します。</p>}</section>
      <section className={`${s.themeCta} ${s[theme.accent]}`}><span className={s.kicker}>READ IT. THEN WATCH IT.</span><h2>読んだ視点を、レースへ。</h2><p>{theme.text}</p>{sections.ctas.length?<ArticleBlocks blocks={sections.ctas} {...props}/>:<Link className={s.ctaButton} href={theme.href} prefetch={false}>{theme.label} ↗</Link>}<div className={s.ctaLinks}><Link href="/races" prefetch={false}>出走表を見る</Link><Link href="/" prefetch={false}>BoatStrikers本体へ</Link></div><small>AI MATESがデータを分析し、3人が専門分野の視点から考察。最終判断は読者自身で。</small></section>
      {children}
    </main>
  </BlogShell>;
}
