import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { makeScene,makeTurn,cloneScene,cloneTurn,replaceTurn,moveAt,sceneTurns,SPEAKERS } from '../../lib/blog/dialogueScene.mjs';
import { BLOG_CHARACTERS,characterImage } from '../../lib/blog/characterAssets.mjs';
import { validateDocument,blankDocument } from '../../lib/blog/document.mjs';
import { speechPresentation } from '../../lib/blog/articleModel.mjs';
const fixedIds=(()=>{let i=0;return()=>`60000000-0000-4000-8000-${String(++i).padStart(12,'0')}`;})();
test('the editor registry uses every real pose and changes speakers to a real pose',()=>{
 for(const speaker of SPEAKERS){const poses=Object.keys(BLOG_CHARACTERS[speaker].poses);assert.ok(poses.length>=5);
  for(const pose of poses)assert.equal(existsSync(join(process.cwd(),'public',characterImage(speaker,pose))),true);
 }
 const scene=makeScene(fixedIds);const changed=replaceTurn(scene,scene.data.turns[0].id,{character:'kiimoko',text:'データを整理したよ',alignment:'right'});
 assert.equal(changed.data.turns[0].pose,'pose1');assert.equal(changed.data.turns[0].character,'kiimoko');
 assert.equal(scene.data.turns[0].character,'ichika');
});
test('scene and turn duplication retain structured content but allocate unique identifiers',()=>{
 const scene=makeScene(fixedIds),first=scene.data.turns[0];
 const withTwo=sceneTurns(scene,[first,cloneTurn(first,fixedIds)]);
 assert.notEqual(withTwo.data.turns[0].id,withTwo.data.turns[1].id);
 assert.equal(speechPresentation(withTwo.data.turns[1],withTwo.data.turns[0]).compact,true);
 const copy=cloneScene(withTwo,fixedIds);
 assert.notEqual(copy.id,withTwo.id);
 assert.deepEqual(copy.data.turns.map(x=>x.text),withTwo.data.turns.map(x=>x.text));
 assert.equal(new Set([withTwo.id,copy.id,...withTwo.data.turns.map(x=>x.id),...copy.data.turns.map(x=>x.id)]).size,6);
 const doc={...blankDocument(),blocks:[withTwo,copy]};assert.equal(validateDocument(doc),doc);
});
test('touch arrow ordering moves without mutating original and respects bounds',()=>{
 const a=[1,2,3];assert.deepEqual(moveAt(a,1,-1),[2,1,3]);assert.deepEqual(moveAt(a,0,-1),a);assert.deepEqual(a,[1,2,3]);
});
