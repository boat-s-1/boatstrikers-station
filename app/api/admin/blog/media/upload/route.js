import {createClient} from '@supabase/supabase-js';
import {blogBody,blogResponse,requireBlogAdmin} from '../../../../../../lib/blog/server';
import {UUID} from '../../../../../../lib/blog/document.mjs';
export const dynamic='force-dynamic';
const formats={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
export async function POST(request){return blogResponse(async()=>{
 await requireBlogAdmin(request,{write:true});
 const body=await blogBody(request),bucket=process.env.BLOG_PRIVATE_MEDIA_BUCKET;
 const client=createClient(process.env.BLOG_SUPABASE_URL,process.env.BLOG_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:container,error:bucketError}=await client.storage.getBucket(bucket);
 if(bucketError||!container||container.public)throw Object.assign(new Error('非公開画像保管先を確認してください。'),{status:503});
 if(body.action==='complete'){
  if(!UUID.test(body.id))throw Object.assign(new Error('画像IDを確認してください。'),{status:400});
  const {data:media,error}=await client.from('blog_media').select('id,storage_path,alt,status').eq('id',body.id).eq('status','private').single();if(error)throw error;
  const {data:info,error:infoError}=await client.storage.from(bucket).info(media.storage_path);
  if(infoError||!info||info.size<1||info.size>8*1024*1024||!formats[info.contentType])throw Object.assign(new Error('画像の形式・容量を確認してください。'),{status:400});
  return {id:media.id,alt:media.alt,status:media.status,public_path:`/api/admin/blog/media/${media.id}`};
 }
 const alt=String(body.alt||'').trim();
 if(!formats[body.type]||!Number.isInteger(body.size)||body.size<1||body.size>8*1024*1024||!alt||alt.length>500)throw Object.assign(new Error('JPEG・PNG・WebPの8MB以下の画像と説明文を指定してください。'),{status:400});
 const path=`drafts/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${formats[body.type]}`;
 const {data:signed,error:signedError}=await client.storage.from(bucket).createSignedUploadUrl(path,{upsert:false});if(signedError)throw signedError;
 const {data:media,error}=await client.from('blog_media').insert({storage_path:path,status:'private',public_path:null,alt}).select('id').single();if(error)throw error;
 // Upload-only token for one random private object. Never return the server API key.
 return {id:media.id,upload_url:signed.signedUrl};
 });}
