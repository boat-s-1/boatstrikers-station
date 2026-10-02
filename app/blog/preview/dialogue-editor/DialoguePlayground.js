'use client';
import { useState } from 'react';
import DialogueSceneEditor from '../../../admin/blog/DialogueSceneEditor';
import { cloneScene,makeScene,moveAt } from '../../../../lib/blog/dialogueScene.mjs';
import s from '../../../admin/blog/blogAdmin.module.css';
const INITIAL=[{id:'50000000-0000-4000-8000-000000000001',type:'DIALOGUE_SCENE',data:{label:'進入の見方を3人で考える',turns:[
 {id:'50000000-0000-4000-8000-000000000002',character:'ichimaru',pose:'pose1',text:'出走表と展示の見方を整理したよ。',alignment:'auto'},
 {id:'50000000-0000-4000-8000-000000000003',character:'ichika',pose:'pose2',text:'まずは1号艇と実際の進入コースを分けて見てみよう。',alignment:'auto'},
 {id:'50000000-0000-4000-8000-000000000004',character:'ichika',pose:'pose3',text:'イン逃げを考えるときも、展示で見えた進入を確認したいね。',alignment:'auto'},
 {id:'50000000-0000-4000-8000-000000000005',character:'hatsune',pose:'pose2',text:'選手ごとの特徴も合わせて見ると、初めてでも整理しやすいですよ。',alignment:'right'},
 {id:'50000000-0000-4000-8000-000000000006',character:'kiina',pose:'pose2',text:'もし進入が変わったら、穴の展開も気になるね。',alignment:'auto'},
]}}];
export default function DialoguePlayground(){
 const [scenes,setScenes]=useState(INITIAL);
 return <main className={s.page}>
  <header id="blog-title" className={s.hero}><p className={s.eyebrow}>BOATSTRIKERS BLOG · PHASE 5 PREVIEW</p><h1>会話シーンを編集</h1><p>iPhone操作を確認するためのPreview専用画面です。入力はこの画面の中だけに保持され、記事・DBには保存されません。</p></header>
  <div className={s.notice}>話者・ポーズ・セリフ・配置を編集できます。発言とシーンの矢印・複製・削除も試してください。</div>
  <section id="articles" className={s.panel}><div className={s.panelHeading}><h2>本文ブロック · 会話シーン</h2><span>{scenes.length}件</span></div>
  <div className={s.blocks}>{scenes.map((scene,i)=><div className={s.block} key={scene.id}><div className={s.blockHead}><strong>会話シーン {i+1}</strong><div className={s.blockActions}>
    <button type="button" aria-label={`会話シーン ${i+1} を上へ`} disabled={i===0} onClick={()=>setScenes(moveAt(scenes,i,-1))}>↑</button>
    <button type="button" aria-label={`会話シーン ${i+1} を下へ`} disabled={i===scenes.length-1} onClick={()=>setScenes(moveAt(scenes,i,1))}>↓</button>
    <button type="button" aria-label={`会話シーン ${i+1} を複製`} onClick={()=>setScenes([...scenes.slice(0,i+1),cloneScene(scene),...scenes.slice(i+1)])}>複製</button>
    <button type="button" aria-label={`会話シーン ${i+1} を削除`} onClick={()=>setScenes(scenes.filter(x=>x.id!==scene.id))}>削除</button>
   </div></div><DialogueSceneEditor scene={scene} onChange={next=>setScenes(current=>current.map(x=>x.id===scene.id?next:x))}/></div>)}</div>
   <div className={s.addBlock}><button type="button" onClick={()=>setScenes([...scenes,makeScene()])}>＋ 会話シーン</button><button type="button" onClick={()=>setScenes(INITIAL)}>最初の状態に戻す</button></div>
   <details className={s.recovery}><summary>構造化された発言データを確認</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(scenes.flatMap(x=>x.data.turns),null,2)}</pre></details>
  </section>
 </main>;
}
