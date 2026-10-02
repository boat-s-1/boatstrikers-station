import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { blankDocument, validateDocument, noteText, safeLink } from '../../lib/blog/document.mjs';
import { BLOG_CHARACTERS, characterImage } from '../../lib/blog/characterAssets.mjs';
import { beginnerTemplate } from '../../lib/blog/beginnerTemplate.mjs';
import { blogRepository } from '../../lib/blog/repository.mjs';

test('all 31 registered images exist with exact case-sensitive filenames',()=>{
 let count=0;for(const [name,c] of Object.entries(BLOG_CHARACTERS))for(const pose of Object.keys(c.poses)){
   assert.ok(existsSync(new URL(`../../public${characterImage(name,pose)}`,import.meta.url)));count++;
 }assert.equal(count,31);
 assert.throws(()=>characterImage('ichika','invented'));
});
test('beginner standard scaffold has requested order and a grouped four-turn scene',()=>{
 const d=beginnerTemplate(randomUUID);assert.equal(validateDocument(d),d);
 assert.deepEqual(d.blocks.map(b=>b.type),['DIALOGUE_SCENE','TEXT','POINT','IMAGE','DATA_CHECK','DIALOGUE_SCENE','HEADING','TEXT','RELATED_ARTICLES','CTA']);
 assert.deepEqual(d.blocks[0].data.turns.map(t=>t.character),['ichika','hatsune','kiina','ichika']);
 assert.equal(d.blocks[3].data.media_id,null);
 const exported=noteText(d);for(const name of ['🌱 一果','💜 初音','⭐ キイナ'])assert.ok(exported.includes(name));
});
test('validation rejects invalid scenes, duplicate IDs, guessed poses and HTML-only documents',()=>{
 for(const mutate of [d=>d.blocks[0].data.turns=[],d=>d.blocks[0].data.turns[0].pose='pose6',d=>d.blocks[0].data.turns[0].alignment='top',d=>d.blocks[0].data.turns[1].id=d.blocks[0].data.turns[0].id,d=>d.blocks[1].id=d.blocks[0].id,d=>d.blocks='<html>']){
   const d=beginnerTemplate(randomUUID);mutate(d);assert.throws(()=>validateDocument(d));
 }
});
test('links reject script/protocol-relative/backslash URLs and race links retain dates',()=>{
 for(const value of ['javascript:alert(1)','//evil.example','/\\evil.example','https://example.test/\nscript'])assert.equal(safeLink(value),false);
 assert.equal(safeLink('/races'),true);assert.equal(safeLink('https://www.boat-strike.online/guide'),true);
 const d=blankDocument();d.blocks=[{id:randomUUID(),type:'RACE_LINK',data:{href:'/races/01/1',race_no:1}}];
 assert.throws(()=>validateDocument(d));d.blocks[0].data.race_date='2026-10-02';validateDocument(d);
});
test('repository autosave calls only draft RPC and refuses unsafe versions or naive dates',async()=>{
 const calls=[];const repository=blogRepository({rpc:async(name,args)=>{calls.push({name,args});return{data:{version:2},error:null};}});
 await repository.save(randomUUID(),1,blankDocument());assert.equal(calls[0].name,'blog_save_draft');
 assert.throws(()=>repository.save(randomUUID(),null,blankDocument()));
 assert.throws(()=>repository.release(randomUUID(),2,'2027-01-01T10:00:00'));
 assert.throws(()=>repository.changeState(randomUUID(),2,'delete'));
});
