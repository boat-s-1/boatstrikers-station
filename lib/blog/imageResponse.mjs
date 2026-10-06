import sharp from 'sharp';

// Keep authenticated, no-store delivery below the hosting response limit.
// The original remains in private Storage; no public or signed download URL is issued.
export async function imageResponse(blob, type, headers) {
  if (blob.size <= 4 * 1024 * 1024) return new Response(blob, {headers:{...headers,'Content-Type':type}});
  const input=Buffer.from(await blob.arrayBuffer());
  const output=await sharp(input,{limitInputPixels:40_000_000}).rotate()
    .resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true})
    .webp({quality:80}).toBuffer();
  if(output.length>4*1024*1024)throw Object.assign(new Error('画像を表示用に変換できません。'),{status:422});
  return new Response(new Uint8Array(output),{headers:{...headers,'Content-Type':'image/webp'}});
}
