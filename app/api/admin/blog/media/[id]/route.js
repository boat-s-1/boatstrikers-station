import { createClient } from '@supabase/supabase-js';
import { requireBlogAdmin,blogResponse } from '../../../../../../lib/blog/server';
import { readPrivateMedia } from '../../../../../../lib/blog/privateMedia.mjs';
export const dynamic='force-dynamic';
export async function GET(request,{params}) {
  let response;
  const error=await blogResponse(async()=>{
    await requireBlogAdmin(request);
    if(!process.env.BLOG_SUPABASE_URL||!process.env.BLOG_SUPABASE_SERVICE_ROLE_KEY) throw Object.assign(new Error('BLOG検証環境が未設定です。'),{status:503});
    const client=createClient(process.env.BLOG_SUPABASE_URL,process.env.BLOG_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    response=await readPrivateMedia(client,process.env.BLOG_PRIVATE_MEDIA_BUCKET,(await params).id);
    return null;
  });
  return response||error;
}
