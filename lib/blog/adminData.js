import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { blogAdminRepository } from './server';

function client() {
  const url=process.env.BLOG_SUPABASE_URL, key=process.env.BLOG_SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw Object.assign(new Error('BLOG検証環境が未設定です。'),{status:503});
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function blogAdminReady(){ return process.env.BLOG_ADMIN_ENABLED==='true' && !!process.env.BLOG_SUPABASE_URL && !!process.env.BLOG_SUPABASE_SERVICE_ROLE_KEY; }
export function blogWritesReady(){ return blogAdminReady() && process.env.BLOG_DB_WRITES_ENABLED==='true'; }
async function rows(table,columns,transform) {
  let query=client().from(table).select(columns);
  if(transform) query=transform(query);
  const {data,error}=await query;
  if(error) throw error;
  return data??[];
}
export async function adminCatalogue(){
  const [authors,categories,tags,media]=await Promise.all([
    rows('blog_authors','id,slug,name,role,bio,character_key,image_path,active',q=>q.eq('active',true).order('name')),
    rows('blog_categories','id,slug,name,active,position',q=>q.eq('active',true).order('position')),
    rows('blog_tags','id,slug,name,role,bio,character_key,image_path,active',q=>q.eq('active',true).order('name')),
    rows('blog_media','id,public_path,alt,status',q=>q.eq('status','public').order('created_at',{ascending:false}).limit(100)),
  ]);
  return {authors,categories,tags,media};
}
export async function adminPosts(){
  const posts=await rows('blog_posts','id,slug,state,editing_revision_id,published_revision_id,scheduled_revision_id,scheduled_at,first_published_at,last_published_at,updated_at,created_at',q=>q.order('updated_at',{ascending:false}).limit(100));
  const revisions=[...new Set(posts.map(p=>p.editing_revision_id||p.scheduled_revision_id||p.published_revision_id).filter(Boolean))];
  if(!revisions.length) return [];
  const [details,authors,categories]=await Promise.all([
    rows('blog_post_revisions','id,title,category_id',q=>q.in('id',revisions)),
    rows('blog_post_authors','revision_id,author_id,position',q=>q.in('revision_id',revisions).order('position')),
    rows('blog_categories','id,name'),
  ]);
  const authorIds=[...new Set(authors.map(a=>a.author_id))];
  const names=authorIds.length?await rows('blog_authors','id,name',q=>q.in('id',authorIds)):[];
  const map=new Map(details.map(r=>[r.id,r]));
  return posts.map(p=>{
    const revision=p.editing_revision_id||p.scheduled_revision_id||p.published_revision_id,detail=map.get(revision);
    return {...p,title:detail?.title||'無題',category:categories.find(c=>c.id===detail?.category_id)?.name||'未設定',authors:authors.filter(a=>a.revision_id===revision).map(a=>names.find(n=>n.id===a.author_id)?.name).filter(Boolean)};
  });
}
export async function editorData(id){
  const [editor,catalogue]=await Promise.all([blogAdminRepository().editor(id),adminCatalogue()]);
  return {editor,catalogue};
}
export async function draftPreviewData(id){
  const {editor,catalogue}=await editorData(id);
  const doc=editor.document;
  const media=Object.fromEntries(catalogue.media.filter(m=>m.public_path).map(m=>[m.id,m]));
  const authors=doc.author_ids.map(a=>catalogue.authors.find(x=>x.id===a)).filter(Boolean).map(a=>({...a}));
  return {post:{id:editor.id,slug:editor.slug},document:doc,authors,category:catalogue.categories.find(c=>c.id===doc.category_id)||null,tags:doc.tag_ids.map(t=>catalogue.tags.find(x=>x.id===t)).filter(Boolean),media,relatedPosts:[]};
}
