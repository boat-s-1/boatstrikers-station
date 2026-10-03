'use client';
import { useState } from 'react';
import DialogueSceneEditor from '../../../admin/blog/DialogueSceneEditor';
import { cloneScene,makeScene,moveAt } from '../../../../lib/blog/dialogueScene.mjs';
import s from '../../../admin/blog/blogAdmin.module.css';
import { useKeyboardInset } from '../../../admin/blog/_lib/useKeyboardInset';
const INITIAL=[
  {
    "id": "70000000-0000-4000-8000-000000000001",
    "type": "DIALOGUE_SCENE",
    "data": {
      "label": "一果 × いちまる · データ確認から考察へ",
      "turns": [
        {
          "id": "70000000-0000-4000-8000-000000000002",
          "character": "ichimaru",
          "pose": "pose1",
          "text": "出走表の艇番と、展示の進入を分けて確認する項目を整理したよ。",
          "alignment": "auto"
        },
        {
          "id": "70000000-0000-4000-8000-000000000003",
          "character": "ichimaru",
          "pose": "pose2",
          "text": "確認できない情報は埋めず、分からないまま一果に渡すね。",
          "alignment": "auto"
        },
        {
          "id": "70000000-0000-4000-8000-000000000004",
          "character": "ichika",
          "pose": "pose1",
          "text": "ありがとう。私はその整理を受け取って、1コースから逃げる条件を考えるよ。",
          "alignment": "auto"
        },
        {
          "id": "70000000-0000-4000-8000-000000000005",
          "character": "ichika",
          "pose": "pose4",
          "text": "データ確認と私の考察を合わせて読み、最後は読者さん自身で判断してね。",
          "alignment": "auto"
        }
      ]
    }
  },
  {
    "id": "70000000-0000-4000-8000-000000000011",
    "type": "DIALOGUE_SCENE",
    "data": {
      "label": "初音 × はつころ · 選手を見るための補足",
      "turns": [
        {
          "id": "70000000-0000-4000-8000-000000000012",
          "character": "hatsukoro",
          "pose": "pose1",
          "text": "女子戦を見るときに、選手情報の出典と更新時点を確認する項目をまとめました。",
          "alignment": "right"
        },
        {
          "id": "70000000-0000-4000-8000-000000000013",
          "character": "hatsukoro",
          "pose": "pose2",
          "text": "今回のPreviewには選手の実数値は入れていません。表示確認用の補足です。",
          "alignment": "right"
        },
        {
          "id": "70000000-0000-4000-8000-000000000014",
          "character": "hatsune",
          "pose": "pose1",
          "text": "初心者さんは、選手の特徴と今回の条件を分けて整理すると読みやすいですよ。",
          "alignment": "auto"
        },
        {
          "id": "70000000-0000-4000-8000-000000000015",
          "character": "hatsune",
          "pose": "pose4",
          "text": "はつころの確認を受け取って、私は女子戦と選手を見る視点から考察します。",
          "alignment": "auto"
        }
      ]
    }
  },
  {
    "id": "70000000-0000-4000-8000-000000000021",
    "type": "DIALOGUE_SCENE",
    "data": {
      "label": "キイナ × きいもこ · 穴条件を整理する",
      "turns": [
        {
          "id": "70000000-0000-4000-8000-000000000022",
          "character": "kiimoko",
          "pose": "pose1",
          "text": "5号艇を見る前に、進入と誰が攻めるかを確認する項目を整理したよ。",
          "alignment": "auto"
        },
        {
          "id": "70000000-0000-4000-8000-000000000023",
          "character": "kiimoko",
          "pose": "pose2",
          "text": "高配当への期待だけで結論を出さず、確認できた材料をキイナに渡すね。",
          "alignment": "auto"
        },
        {
          "id": "70000000-0000-4000-8000-000000000024",
          "character": "kiina",
          "pose": "pose2",
          "text": "私はその材料から、誰に展開が向きそうかを考えたいな。",
          "alignment": "right"
        },
        {
          "id": "70000000-0000-4000-8000-000000000025",
          "character": "kiina",
          "pose": "pose4",
          "text": "きいもこは調査担当、私は穴と展開の考察担当。無理に結論を出さず、見送る視点も大切だね。",
          "alignment": "right"
        }
      ]
    }
  }
];
export default function DialoguePlayground(){
 const [scenes,setScenes]=useState(INITIAL);const [foldedScenes,setFoldedScenes]=useState(()=>new Set(INITIAL.slice(1).map(scene=>scene.id)));const keyboardInset=useKeyboardInset();
 const toggleScene=id=>setFoldedScenes(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
 return <main className={s.page} data-keyboard-open={keyboardInset>100} style={{'--keyboard-inset':`${keyboardInset}px`}}>
  <header id="blog-title" className={s.hero}><p className={s.eyebrow}>BOATSTRIKERS BLOG · PHASE 7 PREVIEW</p><h1>会話シーンを編集</h1><p>iPhone操作を確認するためのPreview専用画面です。入力はこの画面の中だけに保持され、記事・DBには保存されません。</p></header>
  <div className={s.notice}>3人とAI MATESの会話を編集できます。AI MATESはデータ確認・補足の相棒です。2・3番目のシーンを開くと、はつころ・きいもこも確認できます。</div>
  <section id="articles" className={s.panel}><div className={s.panelHeading}><h2>本文ブロック · 会話シーン</h2><span>{scenes.length}件</span></div>
  <div className={s.blocks}>{scenes.map((scene,i)=><div className={s.block} key={scene.id}><div className={s.blockHead}><button type="button" className={s.sceneFold} aria-expanded={!foldedScenes.has(scene.id)} onClick={()=>toggleScene(scene.id)}>{foldedScenes.has(scene.id)?'＋':'−'} 会話シーン {i+1} <small>{scene.data.turns.length}発言 · {foldedScenes.has(scene.id)?'開く':'閉じる'}</small></button><div className={s.blockActions}>
    <button type="button" aria-label={`会話シーン ${i+1} を上へ`} disabled={i===0} onClick={()=>setScenes(moveAt(scenes,i,-1))}>↑</button>
    <button type="button" aria-label={`会話シーン ${i+1} を下へ`} disabled={i===scenes.length-1} onClick={()=>setScenes(moveAt(scenes,i,1))}>↓</button>
    <button type="button" aria-label={`会話シーン ${i+1} を複製`} onClick={()=>setScenes([...scenes.slice(0,i+1),cloneScene(scene),...scenes.slice(i+1)])}>複製</button>
    <button type="button" aria-label={`会話シーン ${i+1} を削除`} onClick={()=>setScenes(scenes.filter(x=>x.id!==scene.id))}>削除</button>
   </div></div>{foldedScenes.has(scene.id)?<p className={s.sceneSummary}>{scene.data.label} · {scene.data.turns.length}発言</p>:null}<div hidden={foldedScenes.has(scene.id)}><DialogueSceneEditor scene={scene} onChange={next=>setScenes(current=>current.map(x=>x.id===scene.id?next:x))}/></div></div>)}</div>
   <div className={s.addBlock}><button type="button" onClick={()=>setScenes([...scenes,makeScene()])}>＋ 会話シーン</button><button type="button" onClick={()=>setScenes(INITIAL)}>最初の状態に戻す</button></div>
   <details className={s.recovery}><summary>構造化された発言データを確認</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(scenes.flatMap(x=>x.data.turns),null,2)}</pre></details>
  </section><div className={s.actionBar}><div className={s.actionInner}><span className={s.status}>Preview専用 · 入力は保存されません</span><button type="button" className={s.primary} disabled>保存</button><button type="button" className={s.button} onClick={()=>document.querySelector('[data-dialogue-live-preview]')?.scrollIntoView({block:'start',behavior:'smooth'})}>プレビュー</button><button type="button" className={s.button} disabled>公開設定</button></div></div>
 </main>;
}
