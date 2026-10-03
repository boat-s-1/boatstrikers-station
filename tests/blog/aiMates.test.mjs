import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOG_CHARACTERS,characterImage } from '../../lib/blog/characterAssets.mjs';
import { makeScene,makeTurn,replaceTurn,cloneScene,moveAt } from '../../lib/blog/dialogueScene.mjs';
import { blankDocument,validateDocument,noteText } from '../../lib/blog/document.mjs';
import { speechPresentation } from '../../lib/blog/articleModel.mjs';
const MATES={ichimaru:{owner:'ichika',count:6},hatsukoro:{owner:'hatsune',count:5},kiimoko:{owner:'kiina',count:5}};
test('AI MATE assets and ownership are explicit',()=>{
 for(const [key,{owner,count}] of Object.entries(MATES)){
  const actor=BLOG_CHARACTERS[key];assert.equal(actor.kind,'mate');assert.equal(actor.owner,owner);assert.ok(actor.role.includes(BLOG_CHARACTERS[owner].name));
  assert.equal(Object.keys(actor.poses).length,count);
  for(const pose of Object.keys(actor.poses))assert.equal(characterImage(key,pose),'/anime/'+key+'/'+actor.poses[pose]);
 }
});
test('all mate poses preserve structured turns, alignment, cloning and note export',()=>{
 for(const key of Object.keys(MATES))for(const pose of Object.keys(BLOG_CHARACTERS[key].poses)){
  const scene=makeScene();const turn=makeTurn(key);scene.data.turns=[turn];
  const changed=replaceTurn(scene,turn.id,{pose,text:'確認した情報を3人に渡します。',alignment:'right'});
  const doc={...blankDocument(),blocks:[changed]};validateDocument(doc);
  assert.equal(speechPresentation(changed.data.turns[0],null).alignment,'right');
  assert.ok(noteText(doc).includes(BLOG_CHARACTERS[key].name));
  const cloned=cloneScene(changed);assert.notEqual(cloned.id,changed.id);assert.notEqual(cloned.data.turns[0].id,turn.id);
  assert.equal(cloned.data.turns[0].pose,pose);assert.equal(cloned.data.turns[0].alignment,'right');
 }
});
test('repeated mate speech is compact and ordering is shared with humans',()=>{
 for(const key of Object.keys(MATES)){
  const a=makeTurn(key),b=makeTurn(key),human=makeTurn(MATES[key].owner);
  assert.equal(speechPresentation(b,a).compact,true);
  assert.equal(speechPresentation(human,b).compact,false);
  const moved=moveAt([a,b,human],1,-1);assert.equal(moved[0].id,b.id);assert.equal(moved[1].id,a.id);
 }
});
