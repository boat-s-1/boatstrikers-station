// BLOG SEO never derives canonical hosts from request/Preview URLs.
export const BLOG_ORIGIN = 'https://www.boat-strike.online';
export const BLOG_NAME = 'BOATSTRIKERS BLOG';
export const BLOG_DESCRIPTION = '一果・初音・キイナと編集部が届ける、ボートレースを調べる・学ぶ・読むメディア。初心者向け解説、イン逃げ、女子戦、穴・展開、データ研究を楽しめます。';
export const DEFAULT_OG_IMAGE = `${BLOG_ORIGIN}/blog/og`;
export const archiveHref = (kind, slug) => `/blog/${kind}/${encodeURIComponent(slug)}`;
export const postHref = slug => `/blog/articles/${encodeURIComponent(slug)}`;
export const isPreviewEnvironment = env => Boolean(env && env !== 'production');
export const absoluteBlogUrl = path => new URL(path, BLOG_ORIGIN).href;
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined;
const validSlug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 150;

export function duePublicPost(post, now = Date.now()) {
  return post?.state === 'published' && validSlug(post.slug) && Boolean(post.published_revision_id)
    && Boolean(date(post.first_published_at)) && Date.parse(post.first_published_at) <= Number(now);
}
export function indexablePost(post, now = Date.now()) {
  return duePublicPost(post, now) && post.revision?.id === post.published_revision_id
    && post.revision?.post_id === post.id && post.revision?.noindex === false;
}
export function imageUrl(value) {
  if (typeof value !== 'string' || /[\s\\\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value, BLOG_ORIGIN);
    if (url.protocol !== 'https:' || url.username || url.password || value.startsWith('//')
      || (!value.startsWith('/') && !value.startsWith('https://'))
      || /(?:^|\/)blog(?:\/preview|-preview)(?:\/|$)/.test(url.pathname)
      || url.search || url.hash || !/\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}
export function articleOgImage(article) {
  const doc = article.document;
  for (const id of [doc.seo.og_media_id, doc.cover.media_id]) {
    const media = article.media?.[id], url = imageUrl(media?.public_path);
    if (url) return { url, alt: doc.seo.og_alt || media.alt || doc.cover.alt || doc.title,
      ...(media.width > 0 ? {width:media.width} : {}), ...(media.height > 0 ? {height:media.height} : {}) };
  }
  return {url:DEFAULT_OG_IMAGE, width:1200, height:630, alt:BLOG_NAME};
}
export function pageMetadata({title=BLOG_NAME,description=BLOG_DESCRIPTION,path='/blog',noindex=false,env}={}) {
  const index = !noindex && !isPreviewEnvironment(env);
  return {title:{absolute:title},description,alternates:{canonical:path},robots:{index,follow:true},
    openGraph:{title,description,url:absoluteBlogUrl(path),siteName:BLOG_NAME,locale:'ja_JP',type:'website',images:[{url:DEFAULT_OG_IMAGE,width:1200,height:630,alt:BLOG_NAME}]},
    twitter:{card:'summary_large_image',title,description,images:[DEFAULT_OG_IMAGE]}};
}
export function blogIndexMetadata(params={}, env) {
  // Every query result is a utility page, including empty search and pagination.
  return pageMetadata({title:`${BLOG_NAME}｜ボートレースを調べる・学ぶ・読む`,env,noindex:Object.keys(params).length>0});
}
export function authorIdentity(author) {
  const character = ['ichika','hatsune','kiina'].includes(author.character_key || author.slug);
  return character ? `${author.name}はBoatStrikersの編集キャラクターです。${author.role || ''}を担当します。`
    : `${author.name}はBoatStrikersの情報を整理・制作する編集部です。`;
}
export function articleMetadata(article, {env,preview=false,now=Date.now()}={}) {
  const d=article.document, p=article.post, title=d.seo.title || d.title, description=d.seo.description || d.excerpt;
  const metadata=pageMetadata({title:`${title}｜${BLOG_NAME}`,description,path:postHref(p.slug),env,
    noindex:preview || d.noindex || !duePublicPost(p,now)});
  const image=articleOgImage(article), published=date(p.first_published_at), modified=date(p.last_published_at);
  return {...metadata,authors:article.authors.map(a=>({name:a.name,url:absoluteBlogUrl(archiveHref('authors',a.slug))})),
    category:article.category?.name,keywords:article.tags.map(t=>t.name),
    openGraph:{...metadata.openGraph,title,type:'article',images:[image],
      ...(!preview && duePublicPost(p,now) ? {publishedTime:published,modifiedTime:modified || published} : {}),
      authors:article.authors.map(a=>absoluteBlogUrl(archiveHref('authors',a.slug))),section:article.category?.name,tags:article.tags.map(t=>t.name)},
    twitter:{...metadata.twitter,title,images:[image.url]}};
}
export function articleStructuredData(article,{env,preview=false,now=Date.now()}={}) {
  if (preview || isPreviewEnvironment(env) || article.document.noindex || !duePublicPost(article.post,now)) return [];
  const {post,document:d,category,authors,tags}=article, url=absoluteBlogUrl(postHref(post.slug));
  const author=authors.map(a=>({'@type':'Organization',name:a.name,
    url:absoluteBlogUrl(archiveHref('authors',a.slug)),description:authorIdentity(a),
    parentOrganization:{'@type':'Organization',name:'BoatStrikers',url:BLOG_ORIGIN}}));
  const crumbs=[{name:BLOG_NAME,url:absoluteBlogUrl('/blog')}];
  if(category) crumbs.push({name:category.name,url:absoluteBlogUrl(archiveHref('categories',category.slug))});
  crumbs.push({name:d.title,url});
  return [ {'@context':'https://schema.org','@type':'BlogPosting','@id':`${url}#article`,url,
    mainEntityOfPage:{'@type':'WebPage','@id':url},headline:d.title,description:d.seo.description || d.excerpt,
    inLanguage:'ja',datePublished:date(post.first_published_at),dateModified:date(post.last_published_at) || date(post.first_published_at),
    image:[articleOgImage(article).url],author,publisher:{'@type':'Organization',name:'BoatStrikers',url:BLOG_ORIGIN},
    articleSection:category?.name,keywords:tags.map(t=>t.name).join(', ')},
    {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:crumbs.map((c,i)=>({'@type':'ListItem',position:i+1,name:c.name,item:c.url}))} ];
}
export const jsonLdText = value => JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');

// Opt-in editorial policy. Tag indexation requires BOTH a unique description
// and at least five due, indexable snapshots. No DB schema changes are needed.
export const TAG_SEO = Object.freeze({});
export function tagIndexable(tag,posts,policy=TAG_SEO,now=Date.now()) {
  const setting=policy[tag.slug];
  return Boolean(setting?.index && setting.description?.trim().length>=80
    && posts.filter(p=>indexablePost(p,now) && p.revision.blog_post_tags?.some(t=>t.tag_id===tag.id)).length>=5);
}
export function blogSitemapEntries(index,{env,now=Date.now(),tagPolicy=TAG_SEO}={}) {
  if(isPreviewEnvironment(env)) return [];
  const posts=index.posts.filter(p=>indexablePost(p,now));
  const entries=[{url:absoluteBlogUrl('/blog'),changeFrequency:'daily',priority:0.8}];
  for(const p of posts) entries.push({url:absoluteBlogUrl(postHref(p.slug)),lastModified:new Date(date(p.last_published_at)||date(p.first_published_at)),changeFrequency:'monthly',priority:0.7});
  for(const [kind,items,belongs] of [
    ['categories',index.categories,(p,i)=>p.revision.category_id===i.id],
    ['authors',index.authors,(p,i)=>p.revision.blog_post_authors?.some(a=>a.author_id===i.id)],
    ['tags',index.tags,(p,i)=>tagIndexable(i,posts,tagPolicy,now)],
  ]) for(const item of items) if(validSlug(item.slug) && posts.some(p=>belongs(p,item))) entries.push({url:absoluteBlogUrl(archiveHref(kind,item.slug)),changeFrequency:'weekly',priority:0.5});
  return entries;
}
export function blogRobots(env) {
  if(isPreviewEnvironment(env)) return {rules:{userAgent:'*',disallow:'/'}};
  return null;
}
