'use client';
import Image from 'next/image';
import { useState } from 'react';
import { BLOG_CHARACTERS,characterImage,poseLabel } from '../../../lib/blog/characterAssets.mjs';
import { SPEAKERS,ALIGNMENTS,makeTurn,cloneTurn,replaceTurn,moveAt,sceneTurns } from '../../../lib/blog/dialogueScene.mjs';
import { ArticleBlocks } from '../../blog/ArticleBlocks';
import s from './dialogueScene.module.css';
const labels={auto:'自動',left:'左',right:'右'};
export default function DialogueSceneEditor({scene,onChange}){
  const turns=scene.data.turns;
  const [collapsed,setCollapsed]=useState(()=>new Set());
  const toggle=id=>setCollapsed(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
  const patch=(turnId,change)=>onChange(replaceTurn(scene,turnId,change));
  const list=(next)=>onChange(sceneTurns(scene,next));
  return <div className={s.editor} data-dialogue-scene-editor>
    <label className={s.label}>シーンの見出し<input value={scene.data.label||''} maxLength={120} onChange={e=>onChange({...scene,data:{...scene.data,label:e.target.value}})} placeholder="例：3人の見方"/></label>
    <p className={s.hint}>発言を追加して、話者・ポーズ・セリフを順に選びます。並び替えは矢印で操作できます。</p>
    <div className={s.turns}>{turns.map((turn,index)=>{
      const actor=BLOG_CHARACTERS[turn.character];
      const folded=collapsed.has(turn.id);
      return <section className={s.turn} key={turn.id} aria-label={`${index+1}番目の発言`}>
        <div className={s.turnHeader}><button type="button" className={s.fold} aria-expanded={!folded} onClick={()=>toggle(turn.id)}>{folded?'＋':'−'} 発言 {index+1} · {actor.name}<span>{folded?'開く':'閉じる'}</span></button><div className={s.actions}>
          <button type="button" aria-label={`発言 ${index+1} を上へ`} disabled={index===0} onClick={()=>list(moveAt(turns,index,-1))}>↑</button>
          <button type="button" aria-label={`発言 ${index+1} を下へ`} disabled={index===turns.length-1} onClick={()=>list(moveAt(turns,index,1))}>↓</button>
          <button type="button" aria-label={`発言 ${index+1} を複製`} disabled={turns.length>=100} onClick={()=>list([...turns.slice(0,index+1),cloneTurn(turn),...turns.slice(index+1)])}>複製</button>
          <button type="button" aria-label={`発言 ${index+1} を削除`} disabled={turns.length===1} onClick={()=>list(turns.filter(x=>x.id!==turn.id))}>削除</button>
        </div></div>
        {folded?<p className={s.turnSummary}>{turn.text||'セリフ未入力'} · {poseLabel(turn.character,turn.pose)}</p>:<div id={`turn-fields-${turn.id}`} className={s.turnFields}><label className={s.label}>話者<select value={turn.character} onChange={e=>patch(turn.id,{character:e.target.value})}>{SPEAKERS.map(key=><option key={key} value={key}>{BLOG_CHARACTERS[key].name}{BLOG_CHARACTERS[key].kind==='mate'?' · AI MATE':''}</option>)}</select></label>
        <fieldset className={s.poses}><legend>ポーズ</legend><div className={s.poseStrip}>{Object.keys(actor.poses).map(pose=><label className={`${s.pose} ${actor.kind==='mate'?s.matePose:''}`} key={pose} data-selected={turn.pose===pose}>
          <input type="radio" name={`pose-${turn.id}`} value={pose} checked={turn.pose===pose} onChange={()=>patch(turn.id,{pose})}/>
          <Image src={characterImage(turn.character,pose)} width={60} height={78} sizes="60px" alt={`${actor.name} ${poseLabel(turn.character,pose)} のポーズ`}/><span>{actor.kind==='human'?poseLabel(turn.character,pose):pose}</span>{turn.pose===pose?<b className={s.selectedMark}>✓ 選択中</b>:null}
        </label>)}</div></fieldset>
        <label className={s.label}>セリフ<textarea rows={3} maxLength={20000} value={turn.text} placeholder={`${actor.name}のセリフを入力`} onChange={e=>patch(turn.id,{text:e.target.value})}/></label>
        <fieldset className={s.align}><legend>配置</legend><div>{ALIGNMENTS.map(value=><label key={value}><input type="radio" name={`align-${turn.id}`} checked={turn.alignment===value} onChange={()=>patch(turn.id,{alignment:value})}/>{labels[value]}</label>)}</div></fieldset></div>}
      </section>;
    })}</div>
    <button type="button" className={s.add} disabled={turns.length>=100} onClick={()=>list([...turns,makeTurn(turns.at(-1)?.character||'ichika')])}>＋ 発言を追加</button>
    <div className={s.preview} data-dialogue-live-preview><div className={s.previewTitle}><strong>即時プレビュー</strong><span>公開ページと同じ表示</span></div><ArticleBlocks blocks={[scene]}/></div>
  </div>;
}
