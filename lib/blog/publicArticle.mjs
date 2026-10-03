import { validateDocument, UUID } from './document.mjs';
import { duePublicPost } from './seo.mjs';
import { safeArticleLink, articleHref } from './articleModel.mjs';

// Server supplies an anonymous BLOG client. No fixture/editor/admin dependency.
export async function readPublicArticle(client, slug, now = new Date().toISOString()) {
  if (typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length>150) return null;
  async function one(query) { const {data,error}=await query; if(error) throw error; return data; }
  async function rows(query) { return (await one(query)) || []; }
  const post=await one(client.from('blog_posts').select('id,slug,state,published_revision_id,first_published_at,last_published_at')
    .eq('slug',slug).eq('state','published').not('published_revision_id','is',null).lte('first_published_at',now).maybeSingle());
  if (!post || !duePublicPost(post, Date.parse(now))) return null;
  const revision=await one(client.from('blog_post_revisions')
    .select('id,post_id,schema_version,title,excerpt,category_id,seo,cover,noindex,blog_blocks(id,position,type,data),blog_post_authors(author_id,position),blog_post_tags(tag_id),blog_post_relations(position,related_post_id,existing_path)')
    .eq('id',post.published_revision_id).eq('post_id',post.id).eq('state','sealed').maybeSingle());
  if (!revision || revision.id!==post.published_revision_id || revision.post_id!==post.id) return null;
  const authorIds=[...(revision.blog_post_authors||[])].sort((a,b)=>a.position-b.position).map(a=>a.author_id);
  const tagIds=(revision.blog_post_tags||[]).map(t=>t.tag_id);
  const relations=[...(revision.blog_post_relations||[])].sort((a,b)=>a.position-b.position).map(r=>r.related_post_id?{post_id:r.related_post_id}:{path:r.existing_path});
  const blocks=[...(revision.blog_blocks||[])].sort((a,b)=>a.position-b.position);
  const document=validateDocument({schema_version:revision.schema_version,title:revision.title,excerpt:revision.excerpt,category_id:revision.category_id,
    seo:revision.seo,cover:revision.cover,noindex:revision.noindex,author_ids:authorIds,tag_ids:tagIds,relations,blocks});
  const mediaIds=[...new Set([document.seo.og_media_id,document.cover.media_id,...blocks.filter(b=>b.type==='IMAGE').map(b=>b.data.media_id)].filter(id=>UUID.test(id)))];
  const relatedIds=[...new Set([...relations.map(r=>r.post_id),...blocks.filter(b=>b.type==='RELATED_ARTICLES').flatMap(b=>b.data.post_ids||[])].filter(id=>UUID.test(id)&&id!==post.id))];
  const [authors,category,tags,media,relatedParents]=await Promise.all([
    authorIds.length?rows(client.from('blog_authors').select('id,slug,name,role,bio,character_key,image_path').eq('active',true).in('id',authorIds)):[],
    revision.category_id?one(client.from('blog_categories').select('id,slug,name').eq('id',revision.category_id).eq('active',true).maybeSingle()):null,
    tagIds.length?rows(client.from('blog_tags').select('id,slug,name').eq('active',true).in('id',tagIds)):[],
    mediaIds.length?rows(client.from('blog_media').select('id,public_path,alt,source,width,height').in('id',mediaIds)):[],
    relatedIds.length?rows(client.from('blog_posts').select('id,slug,state,published_revision_id,first_published_at,last_published_at')
      .in('id',relatedIds).eq('state','published').not('published_revision_id','is',null).lte('first_published_at',now)):[],
  ]);
  // RLS also controls related revisions; never substitute an editing or scheduled version.
  const relatedRevisions=relatedParents.length?await rows(client.from('blog_post_revisions').select('id,post_id,title,excerpt')
    .eq('state','sealed').in('id',relatedParents.map(p=>p.published_revision_id))):[];
  const relatedPosts=relatedParents.flatMap(p=>{
    if (!duePublicPost(p, Date.parse(now))) return [];
    const r=relatedRevisions.find(r=>r.id===p.published_revision_id&&r.post_id===p.id);
    return r?[{id:p.id,slug:p.slug,title:r.title,excerpt:r.excerpt,href:articleHref(p.slug)}]:[];
  });
  return {post,document,category,authors:authorIds.map(id=>authors.find(a=>a.id===id)).filter(Boolean),tags,
    media:Object.fromEntries(media.filter(m=>safeArticleLink(m.public_path)).map(m=>[m.id,m])),relatedPosts};
}
