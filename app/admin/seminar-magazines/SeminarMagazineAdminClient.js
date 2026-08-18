"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./seminarMagazineAdmin.module.css";

const SERIES = {
  ichika: { label: "一果", name: "イン逃げゼミ", weekday: "月曜", day: 1 },
  hatsune: { label: "初音", name: "女子戦攻略新聞", weekday: "水曜", day: 3 },
  kiina: { label: "キイナ", name: "穴党新聞", weekday: "金曜", day: 5 },
};

function nextPublication(series, now = new Date()) {
  const targetDay = SERIES[series]?.day ?? 1;
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  let daysAhead = (targetDay - jst.getUTCDay() + 7) % 7;
  if (daysAhead === 0 && (jst.getUTCHours() > 10 || (jst.getUTCHours() === 10 && jst.getUTCMinutes() > 0))) daysAhead = 7;
  const candidate = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() + daysAhead, 10, 0));
  return candidate.toISOString().slice(0, 16);
}

function makeEmpty(series = "ichika") {
  return { id: null, series, issue_no: "002", number_label: "第002号", title: "", summary: "", premium_start_page: 5, status: "draft", published_at: nextPublication(series), page_paths: [] };
}
function localDate(value){ if(!value)return""; const d=new Date(value); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); }
function sortPages(pages){ return [...pages].sort((a,b)=>Number(a.page)-Number(b.page)); }

export default function SeminarMagazineAdminClient(){
  const [issue,setIssue]=useState(()=>makeEmpty()),[issues,setIssues]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const pageCount = issue.page_paths.length ? Math.max(...issue.page_paths.map(p=>Number(p.page)||0)) : 0;
  const preview = useMemo(()=>issue.issue_no?`/library/${issue.series}-seminar/${issue.issue_no}`:"#",[issue.series,issue.issue_no]);
  const load=useCallback(async()=>{ const r=await fetch('/api/admin/seminar-magazines/issues',{cache:'no-store'}); if(r.status===401){location.href='/admin/radio-blog/login';return;} const j=await r.json(); if(r.ok)setIssues(j.issues||[]); else setMessage(j.error||'取得できませんでした。'); },[]);
  useEffect(()=>{load()},[load]);
  const field=(k,v)=>setIssue(x=>({...x,[k]:v}));
  function fresh(){ setIssue(makeEmpty()); setMessage(""); window.scrollTo({top:0,behavior:'smooth'}); }
  function chooseSeries(series){ setIssue(x=>({...x,series,published_at:x.id?x.published_at:nextPublication(series)})); }
  function setNextPublication(){ field('published_at',nextPublication(issue.series)); setMessage(`${SERIES[issue.series].weekday}10:00に予約設定しました。`); }
  function publicationState(row){ if(row.status!=='published')return'下書き'; if(row.published_at&&new Date(row.published_at).getTime()>Date.now())return'予約公開'; return'公開中'; }
  function edit(row){ setIssue({...row,published_at:localDate(row.published_at),page_paths:sortPages(row.page_paths||[])}); window.scrollTo({top:0,behavior:'smooth'}); }
  async function upload(pageNo,file){ if(!file)return; if(!/^\d{3,4}$/.test(issue.issue_no)){setMessage('先に号数IDを001形式で入力してください。');return;} setBusy(true);setMessage(`${pageNo}ページ目をアップロード中…`); const f=new FormData();f.append('file',file);f.append('series',issue.series);f.append('issue_no',issue.issue_no);f.append('page_no',String(pageNo)); const r=await fetch('/api/admin/seminar-magazines/upload',{method:'POST',body:f});const j=await r.json();setBusy(false); if(!r.ok){setMessage(j.error||'アップロード失敗');return;} setIssue(x=>{const rest=(x.page_paths||[]).filter(p=>Number(p.page)!==pageNo);return {...x,page_paths:sortPages([...rest,{page:pageNo,path:j.path,preview_url:j.preview_url}])}});setMessage(`${pageNo}ページ目を登録しました。`); }
  function removePage(pageNo){setIssue(x=>({...x,page_paths:(x.page_paths||[]).filter(p=>Number(p.page)!==pageNo)}));}
  async function save(status){ setBusy(true);setMessage('保存中…'); const body={...issue,status,published_at:issue.published_at?new Date(issue.published_at).toISOString():null,page_paths:(issue.page_paths||[]).map(({page,path})=>({page:Number(page),path}))}; const endpoint=issue.id?`/api/admin/seminar-magazines/issues/${issue.id}`:'/api/admin/seminar-magazines/issues'; const r=await fetch(endpoint,{method:issue.id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();setBusy(false);if(!r.ok){setMessage(j.error||'保存に失敗しました。');return;}setIssue({...j.issue,published_at:localDate(j.issue.published_at),page_paths:issue.page_paths});const scheduled=status==='published'&&body.published_at&&new Date(body.published_at).getTime()>Date.now();setMessage(status==='published'?(scheduled?'予約公開を設定しました。':'公開しました。'):'下書き保存しました。');load(); }
  async function del(){if(!issue.id||!confirm('この号を削除しますか？'))return;const r=await fetch(`/api/admin/seminar-magazines/issues/${issue.id}`,{method:'DELETE'});if(r.ok){fresh();load();}else setMessage('削除に失敗しました。');}
  const slots=Array.from({length:Math.max(8,pageCount+1)},(_,i)=>i+1);
  return <>
    <header className={styles.header}><div><span>BOATSTRIKERS PUBLISHING</span><h1>攻略マガジン管理</h1><p>画像を順番に登録し、何ページ目からPremiumにするかを号ごとに設定できます。</p></div><button onClick={fresh}>＋ 新しい号</button></header>
    <section className={styles.panel}>
      <h2>1. 基本情報</h2>
      <div className={styles.grid3}>
        <label>シリーズ<select value={issue.series} onChange={e=>chooseSeries(e.target.value)}>{Object.entries(SERIES).map(([k,v])=><option key={k} value={k}>{v.label}｜{v.name}</option>)}</select></label>
        <label>号数ID<input value={issue.issue_no} onChange={e=>field('issue_no',e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="002" /></label>
        <label>表示名<input value={issue.number_label} onChange={e=>field('number_label',e.target.value)} placeholder="第002号" /></label>
      </div>
      <label>タイトル<input value={issue.title} onChange={e=>field('title',e.target.value)} placeholder="今週の攻略テーマ" /></label>
      <label>一覧用紹介文<textarea rows="3" value={issue.summary||''} onChange={e=>field('summary',e.target.value)} /></label>
      <div className={styles.grid3}>
        <label>Premium開始ページ<input type="number" min="1" max="99" value={issue.premium_start_page} onChange={e=>field('premium_start_page',Math.max(1,Number(e.target.value||1)))} /><small>例：5 → 1〜4ページ無料、5ページ目から有料</small></label>
        <label>公開日時<input type="datetime-local" value={issue.published_at||''} onChange={e=>field('published_at',e.target.value)} /><button type="button" className={styles.upload} onClick={setNextPublication}>次の{SERIES[issue.series].weekday} 10:00に設定</button></label>
        <label>状態<select value={issue.status} onChange={e=>field('status',e.target.value)}><option value="draft">下書き</option><option value="published">公開</option></select></label>
      </div>
    </section>
    <section className={styles.panel}>
      <div className={styles.sectionHead}><div><h2>2. ページ画像</h2><p>1ページ目が一覧の表紙になります。Premium開始ページ以降は認証後だけ表示します。</p></div><strong>{pageCount}ページ登録済み</strong></div>
      <div className={styles.pages}>{slots.map(pageNo=>{const p=(issue.page_paths||[]).find(x=>Number(x.page)===pageNo);const premium=pageNo>=Number(issue.premium_start_page||5);return <article key={pageNo} className={`${styles.pageCard} ${premium?styles.premium:''}`}><div className={styles.pageTop}><b>{pageNo}ページ</b><span>{premium?'PREMIUM':'FREE'}</span></div><div className={styles.preview}>{p?.preview_url?<img src={p.preview_url} alt={`${pageNo}ページ`}/>:<span>画像未登録</span>}</div><label className={styles.upload}>{p?'画像を差し替え':'画像を追加'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload(pageNo,e.target.files?.[0])}/></label>{p&&<button className={styles.remove} onClick={()=>removePage(pageNo)}>このページを外す</button>}</article>})}</div>
    </section>
    <div className={styles.sticky}><span>{message}</span><a href={preview} target="_blank">プレビュー</a>{issue.id&&<button className={styles.delete} onClick={del}>削除</button>}<button disabled={busy} onClick={()=>save('draft')}>下書き保存</button><button className={styles.publish} disabled={busy} onClick={()=>save('published')}>{busy?'処理中…':'保存して公開'}</button></div>
    <section className={styles.list}><h2>登録済み</h2>{issues.length===0?<p>まだ管理画面から登録した号はありません。</p>:issues.map(x=><article key={x.id}><div><small>{SERIES[x.series]?.label}・{x.number_label||x.issue_no}</small><h3>{x.title}</h3><p>{publicationState(x)}{x.published_at?`（${new Date(x.published_at).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}）`:''} / Premium {x.premium_start_page}P〜 / {(x.page_paths||[]).length}P</p></div><button onClick={()=>edit(x)}>編集</button></article>)}</section>
  </>;
}
