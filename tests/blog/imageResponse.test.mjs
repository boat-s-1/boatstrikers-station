import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {imageResponse} from '../../lib/blog/imageResponse.mjs';
test('small images retain their original bytes and no-store headers',async()=>{
 const bytes=await sharp({create:{width:10,height:10,channels:3,background:'#21834a'}}).png().toBuffer();
 const response=await imageResponse(new Blob([bytes]),'image/png',{'Cache-Control':'private, no-store'});
 assert.equal(response.headers.get('Content-Type'),'image/png');
 assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
});
test('large originals are delivered as valid images below the function response limit',async()=>{
 const bytes=await sharp({create:{width:640,height:360,channels:3,background:'#21834a'}}).jpeg().toBuffer();
 const response=await imageResponse(new Blob([bytes,Buffer.alloc(6*1024*1024)]),'image/jpeg',{'Cache-Control':'private, no-store'});
 const output=Buffer.from(await response.arrayBuffer());
 assert.equal(response.headers.get('Content-Type'),'image/webp');
 assert.ok(output.length<4*1024*1024);
 assert.equal((await sharp(output).metadata()).width,640);
});
