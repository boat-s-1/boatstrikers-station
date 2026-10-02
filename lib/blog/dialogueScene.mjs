import { BLOG_CHARACTERS } from './characterAssets.mjs';
export const SPEAKERS=['ichika','hatsune','kiina','ichimaru','hatsukoro','kiimoko'];
export const ALIGNMENTS=['auto','left','right'];
export function makeTurn(character='ichika',id=()=>crypto.randomUUID()) {
  if(!SPEAKERS.includes(character)) throw new Error('Unknown speaker');
  return {id:id(),character,pose:Object.keys(BLOG_CHARACTERS[character].poses)[0],text:'',alignment:'auto'};
}
export function makeScene(id=()=>crypto.randomUUID()) {
  return {id:id(),type:'DIALOGUE_SCENE',data:{label:'会話シーン',turns:[makeTurn('ichika',id)]}};
}
export function cloneTurn(turn,id=()=>crypto.randomUUID()) {return {...turn,id:id()};}
export function cloneScene(scene,id=()=>crypto.randomUUID()) {
  return {...scene,id:id(),data:{...scene.data,turns:scene.data.turns.map(turn=>cloneTurn(turn,id))}};
}
export function replaceTurn(scene,turnId,patch) {
  const turns=scene.data.turns.map(turn=>{
    if(turn.id!==turnId)return turn;
    const next={...turn,...patch};
    if(patch.character&&patch.character!==turn.character) {
      if(!SPEAKERS.includes(patch.character))throw new Error('Unknown speaker');
      next.pose=Object.keys(BLOG_CHARACTERS[patch.character].poses)[0];
    }
    if(!BLOG_CHARACTERS[next.character]?.poses[next.pose]||!ALIGNMENTS.includes(next.alignment))throw new Error('Invalid dialogue turn');
    return next;
  });
  return {...scene,data:{...scene.data,turns}};
}
export function moveAt(items,index,step) {
  const target=index+step;if(target<0||target>=items.length)return items;
  const copy=[...items];[copy[index],copy[target]]=[copy[target],copy[index]];return copy;
}
export function sceneTurns(scene,turns) {return {...scene,data:{...scene.data,turns}};}
