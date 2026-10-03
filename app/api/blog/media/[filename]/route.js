import { createClient } from '@supabase/supabase-js';
import { UUID } from '../../../../../lib/blog/document.mjs';
export const dynamic='force-dynamic';
export async function GET(request,{params}) {
 const id=(await params).filename.replace(/\.png$/,'');
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'};
 const deny=()=>new Response(null,{status:404,headers});
 if(!UUID.test(id))return deny();
 const url=process.env.BLOG_SUPABASE_URL,key=process.env.BLOG_SUPABASE_ANON_KEY,secret=process.env.BLOG_SUPABASE_SERVICE_ROLE_KEY,bucket=process.env.BLOG_PRIVATE_MEDIA_BUCKET;
 if(!url||!key||!secret||!bucket)return deny();
 const options={auth:{persistSession:false,autoRefreshToken:false}};
 // Authorization is evaluated as anon, before using the server-only download client.
 const anon=createClient(url,key,options);
 const {data:visible,error}=await anon.from('blog_media').select('id').eq('id',id).maybeSingle();
 if(error||!visible)return deny();
 const admin=createClient(url,secret,options);
 const {data:media,error:mediaError}=await admin.from('blog_media').select('storage_path').eq('id',id).single();
 if(mediaError||!/^drafts\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.(jpg|png|webp)$/.test(media?.storage_path||''))return deny();
 const {data:container,error:bucketError}=await admin.storage.getBucket(bucket);
 if(bucketError||!container||container.public)return deny();
 const {data:blob,error:downloadError}=await admin.storage.from(bucket).download(media.storage_path);
 if(downloadError||!blob)return deny();
 const type=media.storage_path.endsWith('.jpg')?'image/jpeg':media.storage_path.endsWith('.webp')?'image/webp':'image/png';
 return new Response(blob,{headers:{...headers,'Content-Type':type}});
}
