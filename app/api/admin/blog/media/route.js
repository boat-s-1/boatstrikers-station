import { createClient } from '@supabase/supabase-js';
import { blogResponse,requireBlogAdmin } from '../../../../../lib/blog/server';
const formats={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
export async function POST(request){return blogResponse(async()=>{
 await requireBlogAdmin(request,{write:true});
 const bucket=process.env.BLOG_MEDIA_BUCKET;
 if(!bucket||!process.env.BLOG_SUPABASE_URL||!process.env.BLOG_SUPABASE_SERVICE_ROLE_KEY)throw Object.assign(new Error('BLOG画像保管先が未設定です。'),{status:503});
 const form=await request.formData(),file=form.get('file'),alt=String(form.get('alt')||'').trim();
 if(!(file instanceof File)||!formats[file.type]||file.size<1||file.size>8*1024*1024||!alt||alt.length>500)throw Object.assign(new Error('JPEG・PNG・WebPの8MB以下の画像と説明文を指定してください。'),{status:400});
 const client=createClient(process.env.BLOG_SUPABASE_URL,process.env.BLOG_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:container,error:bucketError}=await client.storage.getBucket(bucket);
 if(bucketError||!container?.public)throw Object.assign(new Error('BLOG画像用の公開バケットを検証環境に準備してください。'),{status:503});
 const path=`articles/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${formats[file.type]}`;
 const {error:uploadError}=await client.storage.from(bucket).upload(path,await file.arrayBuffer(),{contentType:file.type,upsert:false,cacheControl:'3600'});
 if(uploadError)throw uploadError;
 const {data:url}=client.storage.from(bucket).getPublicUrl(path);
 try{const {data,error}=await client.from('blog_media').insert({storage_path:path,status:'public',public_path:url.publicUrl,alt}).select('id,public_path,alt,status').single();if(error)throw error;return data;}
 catch(error){await client.storage.from(bucket).remove([path]);throw error;}
 });}
