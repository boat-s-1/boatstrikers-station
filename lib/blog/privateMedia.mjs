import { UUID } from './document.mjs';
import { imageResponse } from './imageResponse.mjs';
export const PRIVATE_MEDIA_HEADERS = { 'Cache-Control':'private, no-store', 'X-Robots-Tag':'noindex, nofollow', 'X-Content-Type-Options':'nosniff' };
export async function readPrivateMedia(client, bucket, id, includePublished = false) {
  if (!UUID.test(id)) throw Object.assign(new Error('画像が見つかりません。'),{status:404});
  if (!bucket) throw Object.assign(new Error('非公開画像保管先が未設定です。'),{status:503});
  const {data:container,error:bucketError}=await client.storage.getBucket(bucket);
  if(bucketError||!container||container.public) throw Object.assign(new Error('非公開画像保管先を確認してください。'),{status:503});
  let query=client.from('blog_media').select('storage_path,status').eq('id',id);
  if(!includePublished)query=query.eq('status','private');
  const {data:media,error}=await query.maybeSingle();
  if(error) throw error;
  if(!media||(!includePublished&&media.status!=='private')||!/^drafts\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]+\.(png|jpg|webp)$/.test(media.storage_path)) throw Object.assign(new Error('画像が見つかりません。'),{status:404});
  const {data:blob,error:downloadError}=await client.storage.from(bucket).download(media.storage_path);
  if(downloadError||!blob) throw Object.assign(new Error('画像を読み込めません。'),{status:503});
  const type=media.storage_path.endsWith('.jpg')?'image/jpeg':media.storage_path.endsWith('.webp')?'image/webp':'image/png';
  return imageResponse(blob,type,PRIVATE_MEDIA_HEADERS);
}
