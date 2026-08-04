"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./magazineAdmin.module.css";

const BLOCK_TYPES = [
  ["lead", "特集リード", "大きな見出しと導入文"],
  ["image", "フル画像", "漫画・図解・誌面画像"],
  ["article", "本文記事", "画像＋本文の基本記事"],
  ["speech", "キャラクター吹き出し", "一果・初音・キイナの会話"],
  ["point", "ポイントカード", "重要事項を目立たせる"],
  ["ai", "AI分析カード", "数値・評価・根拠"],
  ["comparison", "実例比較", "画像と解説を左右に表示"],
  ["checklist", "チェックリスト", "実践項目を一覧表示"],
  ["ranking", "ランキング", "順位付きの項目一覧"],
  ["quote", "コラム・引用", "短い補足や一言メモ"],
  ["divider", "章扉", "章タイトルだけを大きく表示"],
  ["next", "次号予告", "次号テーマを大きく告知"],
];
const CHARACTERS = [["ichika","一果"],["hatsune","初音"],["kiina","キイナ"],["editor","編集部"]];
const LAYOUTS = [["standard","標準"],["wide","横長"],["split","左右2カラム"],["compact","コンパクト"]];
const EMPTY={id:null,slug:"",volume:"Vol.001",title:"",subtitle:"",summary:"",cover_image_url:"",theme_color:"#0c3f78",accent_color:"#ff4f87",status:"draft",published_at:"",sections:[]};

function makeBlock(type="article"){
  const title=BLOCK_TYPES.find(x=>x[0]===type)?.[1]||"本文記事";
  return {id:crypto.randomUUID(),type,title,kicker:"",body:"",image_url:"",image_url_2:"",caption:"",points:[""],metrics:[{label:"逃げ率",value:"",note:""}],character:"ichika",layout:"standard",badge:"",next_issue:""};
}
function normalizeBlock(s){return {...makeBlock(s.type||"article"),...s,id:s.id||crypto.randomUUID(),points:Array.isArray(s.points)?s.points:[""],metrics:Array.isArray(s.metrics)&&s.metrics.length?s.metrics:[{label:"逃げ率",value:"",note:""}]};}
function toLocal(v){if(!v)return"";const d=new Date(v);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function payload(issue){return {...issue,published_at:issue.published_at?new Date(issue.published_at).toISOString():null}}

export default function MagazineAdminClient(){
 const [issues,setIssues]=useState([]),[issue,setIssue]=useState({...EMPTY,sections:[makeBlock("lead"),makeBlock("image"),makeBlock("article"),makeBlock("ai"),makeBlock("checklist"),makeBlock("next")]}),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [addType,setAddType]=useState("article");
 const load=useCallback(async()=>{const r=await fetch('/api/admin/magazine/issues',{cache:'no-store'});if(r.status===401){location.href='/admin/radio-blog/login';return}const j=await r.json();if(r.ok)setIssues(j.issues||[]);else setMessage(j.error||'取得できませんでした。')},[]);
 useEffect(()=>{load()},[load]);
 const previewHref=useMemo(()=>issue.slug?`/library/weekly/${issue.slug}`:'/library/weekly',[issue.slug]);
 function fresh(){setIssue({...EMPTY,sections:[makeBlock("lead"),makeBlock("image"),makeBlock("article"),makeBlock("ai"),makeBlock("checklist"),makeBlock("next")]});setMessage('');scrollTo({top:0,behavior:'smooth'})}
 function edit(row){setIssue({...row,cover_image_url:row.cover_image_url||'',published_at:toLocal(row.published_at),sections:(row.sections||[]).map(normalizeBlock)});scrollTo({top:0,behavior:'smooth'})}
 function field(k,v){setIssue(x=>({...x,[k]:v}))}
 function section(i,patch){setIssue(x=>({...x,sections:x.sections.map((s,n)=>n===i?{...s,...patch}:s)}))}
 function add(type=addType){setIssue(x=>({...x,sections:[...x.sections,makeBlock(type)]}))}
 function duplicate(i){setIssue(x=>{const copy=normalizeBlock({...x.sections[i],id:crypto.randomUUID()});const a=[...x.sections];a.splice(i+1,0,copy);return {...x,sections:a}})}
 function remove(i){if(!confirm('このブロックを削除しますか？'))return;setIssue(x=>({...x,sections:x.sections.filter((_,n)=>n!==i)}))}
 function move(i,d){const n=i+d;if(n<0||n>=issue.sections.length)return;setIssue(x=>{const a=[...x.sections];[a[i],a[n]]=[a[n],a[i]];return {...x,sections:a}})}
 async function upload(file,done){if(!file)return;setBusy(true);setMessage('画像をアップロード中…');const f=new FormData();f.append('file',file);const r=await fetch('/api/admin/magazine/upload',{method:'POST',body:f});const j=await r.json();setBusy(false);if(!r.ok){setMessage(j.error||'アップロード失敗');return}done(j.url);setMessage('画像をアップロードしました。')}
 async function save(e,forcedStatus=null){e?.preventDefault?.();setBusy(true);setMessage('');const nextIssue=forcedStatus?{...issue,status:forcedStatus}:issue;const endpoint=issue.id?`/api/admin/magazine/issues/${issue.id}`:'/api/admin/magazine/issues';const r=await fetch(endpoint,{method:issue.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload(nextIssue))});const j=await r.json();setBusy(false);if(!r.ok){setMessage(j.error||'保存に失敗しました。');return}setIssue({...j.issue,cover_image_url:j.issue.cover_image_url||'',published_at:toLocal(j.issue.published_at),sections:(j.issue.sections||[]).map(normalizeBlock)});setMessage(forcedStatus==='published'?'保存して公開しました。':'下書きを保存しました。');load()}
 async function del(){if(!issue.id||!confirm('この雑誌を削除しますか？'))return;const r=await fetch(`/api/admin/magazine/issues/${issue.id}`,{method:'DELETE'});if(r.ok){fresh();load()}else setMessage('削除に失敗しました。')}
 function imageEditor(i,key,label){const s=issue.sections[i];return <div className={styles.imageField}><div>{s[key]?<img src={s[key]} alt="誌面"/>:<span>{label}</span>}</div><label className={styles.upload}>{label}を選択<input type="file" accept="image/*" onChange={e=>upload(e.target.files?.[0],url=>section(i,{[key]:url}))}/></label><input value={s[key]||''} onChange={e=>section(i,{[key]:e.target.value})} placeholder="画像URL"/></div>}
 return <>
  <header className={styles.header}><div><span>BOATSTRIKERS PUBLISHING</span><h1>雑誌ブロックエディタ</h1><p>好きなブロックを追加・並べ替えるだけで、雑誌デザインへ自動変換します。</p></div><div className={styles.headerActions}><a href="/library/weekly" target="_blank">公開一覧</a><button type="button" onClick={fresh}>＋ 新しい号</button></div></header>
  <form onSubmit={save} className={styles.editor}>
   <section className={styles.panel}><h2>1. 表紙・基本情報</h2><div className={styles.grid3}><label>URL名<input value={issue.slug} onChange={e=>field('slug',e.target.value)} placeholder="vol-001" required/></label><label>号数<input value={issue.volume} onChange={e=>field('volume',e.target.value)}/></label><label>公開状態<select value={issue.status} onChange={e=>field('status',e.target.value)}><option value="draft">下書き</option><option value="published">公開</option></select></label></div><label>表紙の大見出し<input value={issue.title} onChange={e=>field('title',e.target.value)} placeholder="インが飛ぶ条件7選" required/></label><label>表紙のサブタイトル<input value={issue.subtitle} onChange={e=>field('subtitle',e.target.value)}/></label><label>一覧用紹介文<textarea rows="3" value={issue.summary} onChange={e=>field('summary',e.target.value)}/></label><div className={styles.grid3}><label>公開日時<input type="datetime-local" value={issue.published_at} onChange={e=>field('published_at',e.target.value)}/></label><label>テーマ色<input type="color" value={issue.theme_color} onChange={e=>field('theme_color',e.target.value)}/></label><label>アクセント色<input type="color" value={issue.accent_color} onChange={e=>field('accent_color',e.target.value)}/></label></div><div className={styles.imageField}><div>{issue.cover_image_url?<img src={issue.cover_image_url} alt="表紙"/>:<span>表紙画像</span>}</div><label className={styles.upload}>表紙画像を選択<input type="file" accept="image/*" onChange={e=>upload(e.target.files?.[0],url=>field('cover_image_url',url))}/></label><input value={issue.cover_image_url} onChange={e=>field('cover_image_url',e.target.value)} placeholder="画像URL"/></div></section>
   <section className={styles.panel}><div className={styles.sectionHead}><div><h2>2. 誌面ブロック</h2><p>上から順番に誌面へ表示されます。複製・並べ替えも可能です。</p></div><div className={styles.addBlock}><select value={addType} onChange={e=>setAddType(e.target.value)}>{BLOCK_TYPES.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select><button type="button" onClick={()=>add()}>＋ 追加</button></div></div>
    <div className={styles.palette}>{BLOCK_TYPES.map(([v,l,d])=><button key={v} type="button" onClick={()=>add(v)}><b>{l}</b><small>{d}</small></button>)}</div>
    <div className={styles.blocks}>{issue.sections.map((s,i)=><article className={styles.block} key={s.id||i}><div className={styles.blockBar}><div><span>{String(i+1).padStart(2,'0')}</span><b>{BLOCK_TYPES.find(x=>x[0]===s.type)?.[1]||'本文記事'}</b></div><div><button type="button" onClick={()=>move(i,-1)}>↑</button><button type="button" onClick={()=>move(i,1)}>↓</button><button type="button" onClick={()=>duplicate(i)}>複製</button><button type="button" className={styles.remove} onClick={()=>remove(i)}>削除</button></div></div>
      <div className={styles.grid3}><label>ブロック種類<select value={s.type} onChange={e=>section(i,{type:e.target.value})}>{BLOCK_TYPES.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>レイアウト<select value={s.layout||'standard'} onChange={e=>section(i,{layout:e.target.value})}>{LAYOUTS.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>ラベル<input value={s.badge||''} onChange={e=>section(i,{badge:e.target.value})} placeholder="保存版・注目など"/></label></div>
      {!['image','divider'].includes(s.type)&&<><label>小見出し<input value={s.kicker||''} onChange={e=>section(i,{kicker:e.target.value})} placeholder="FEATURE / POINT"/></label><label>見出し<input value={s.title||''} onChange={e=>section(i,{title:e.target.value})}/></label></>}
      {s.type==='divider'&&<><label>章番号・小見出し<input value={s.kicker||''} onChange={e=>section(i,{kicker:e.target.value})} placeholder="CHAPTER 01"/></label><label>章タイトル<input value={s.title||''} onChange={e=>section(i,{title:e.target.value})}/></label></>}
      {s.type==='speech'&&<label>話すキャラクター<select value={s.character||'ichika'} onChange={e=>section(i,{character:e.target.value})}>{CHARACTERS.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>}
      {!['image','divider'].includes(s.type)&&<label>本文<textarea rows="6" value={s.body||''} onChange={e=>section(i,{body:e.target.value})} placeholder="短い段落を重ねると読みやすくなります。"/></label>}
      {!['speech','point','checklist','ranking','quote','divider','next'].includes(s.type)&&imageEditor(i,'image_url','メイン画像')}
      {s.type==='image'&&imageEditor(i,'image_url','フル画像')}
      {s.type==='comparison'&&imageEditor(i,'image_url_2','比較画像')}
      {['image','article','comparison'].includes(s.type)&&<label>画像キャプション<input value={s.caption||''} onChange={e=>section(i,{caption:e.target.value})}/></label>}
      {['point','checklist','ranking','article'].includes(s.type)&&<label>項目（1行に1項目）<textarea rows="5" value={(s.points||[]).join('\n')} onChange={e=>section(i,{points:e.target.value.split('\n')})} placeholder={'展示順位を確認\nSTは.15以内か\n風向き・風速を見る'}/></label>}
      {s.type==='ai'&&<div className={styles.metrics}><h4>AI数値カード</h4>{(s.metrics||[]).map((m,n)=><div key={n}><input value={m.label||''} onChange={e=>section(i,{metrics:s.metrics.map((x,k)=>k===n?{...x,label:e.target.value}:x)})} placeholder="項目名"/><input value={m.value||''} onChange={e=>section(i,{metrics:s.metrics.map((x,k)=>k===n?{...x,value:e.target.value}:x)})} placeholder="82%"/><input value={m.note||''} onChange={e=>section(i,{metrics:s.metrics.map((x,k)=>k===n?{...x,note:e.target.value}:x)})} placeholder="補足"/><button type="button" onClick={()=>section(i,{metrics:s.metrics.filter((_,k)=>k!==n)})}>×</button></div>)}<button type="button" onClick={()=>section(i,{metrics:[...(s.metrics||[]),{label:"",value:"",note:""}]})}>＋ 数値を追加</button></div>}
      {s.type==='next'&&<label>次号テーマ<input value={s.next_issue||''} onChange={e=>section(i,{next_issue:e.target.value})} placeholder="展示タイムは本当に重要？"/></label>}
    </article>)}</div>
   </section>
   <div className={styles.sticky}><span>{message}</span><a className={styles.preview} href={previewHref} target="_blank">プレビュー</a>{issue.id&&<button type="button" className={styles.delete} onClick={del}>削除</button>}<button type="button" disabled={busy} onClick={e=>save(e,'draft')}>下書き保存</button><button type="button" disabled={busy} onClick={e=>save(e,'published')}>{busy?'処理中…':'保存して公開'}</button></div>
  </form>
  <section className={styles.list}><h2>登録済みの雑誌</h2>{issues.length===0?<p>まだ登録がありません。</p>:issues.map(x=><article key={x.id}><div>{x.cover_image_url?<img src={x.cover_image_url} alt=""/>:<span>BOOK</span>}</div><section><small>{x.volume}・{x.status==='published'?'公開中':'下書き'}</small><h3>{x.title}</h3><p>{x.summary}</p></section><button onClick={()=>edit(x)}>編集</button></article>)}</section>
 </>
}
