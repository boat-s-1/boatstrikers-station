'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { VENUES, INVENTORY_DATE, diagnosticStatus } from '../../../../lib/exhibitionStatusCatalog';
import styles from '../alerts.module.css';

export default function ExhibitionStatus(){
 const [date,setDate]=useState(''),[race,setRace]=useState('1'),[filter,setFilter]=useState('all'),[results,setResults]=useState({}),[busy,setBusy]=useState(null);
 const inFlight=useRef(false),controller=useRef(null);
 useEffect(()=>{setDate(new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}));return ()=>controller.current?.abort();},[]);
 const key=code=>`${date}/${race}/${code}`;
 async function check(venue){
  if(inFlight.current||!date||!venue.endpoint)return;
  inFlight.current=true;setBusy(venue.code);const requestKey=key(venue.code),requested={date,race};
  controller.current=new AbortController();const timer=setTimeout(()=>controller.current.abort(),25000);
  try{
   const response=await fetch(`${venue.endpoint}?course=${venue.code}&date=${date}&race=${race}`,{cache:'no-store',signal:controller.current.signal});
   const body=await response.json();if(!response.ok&&body.ok)throw new Error('http_error');
   setResults(old=>({...old,[requestKey]:{body,requested,checkedAt:new Date().toISOString()}}));
  }catch{setResults(old=>({...old,[requestKey]:{body:{ok:false,error:'browser_fetch_failed'},requested,checkedAt:new Date().toISOString()}}));}
  finally{clearTimeout(timer);inFlight.current=false;setBusy(null);}
 }
 const shown=VENUES.filter(v=>filter==='all'||(filter==='checkable'?v.endpoint:v.stage===filter));
 return <main className={styles.page}><div className={styles.shell}>
  <Link className={styles.back} href="/admin/alerts">← アラート管理に戻る</Link>
  <header className={styles.hero}><span>OFFICIAL EXHIBITION / 24 VENUES</span><h1>24場の展示データ対応状況</h1><p>実装状況と、指定レースの取得結果を分けて確認します。</p></header>
  <div className={styles.summary}>{['接続済み','検証用実装','既存取得経路','調査中'].map(stage=><span key={stage}>{stage} <strong>{VENUES.filter(v=>v.stage===stage).length}場</strong></span>)}</div>
  <div className={styles.notice}>実装台帳：{INVENTORY_DATE}時点。「接続済み」は当日の展示公開や通知成功を保証しません。確認ボタンは読み取り専用で、LINE送信・DB保存はしません。取得結果はこの画面を開いている間だけ保持します。<br/>「対象項目なし」は確認済み取得元に直線がない場です。未確認・欠測・取得失敗とは区別しています。開催日程の自動判定は行いません。</div>
  <div className={styles.controls}>
   <label>開催日（日本時間）<input type="date" value={date} disabled={busy!==null} onChange={e=>setDate(e.target.value)}/></label>
   <label>レース<select value={race} disabled={busy!==null} onChange={e=>setRace(e.target.value)}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}R</option>)}</select></label>
   <label>絞り込み<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">全24場</option><option value="checkable">個別確認できる場</option>{['接続済み','検証用実装','既存取得経路','調査中'].map(s=><option key={s}>{s}</option>)}</select></label>
   <Link href="/admin/exhibition-data-status">保存済み展示データの集計を見る →</Link>
  </div>
  <p role="status" aria-live="polite">{busy!==null?`${VENUES[busy-1].name}を確認中…`:`${shown.length}場を表示。1場ずつ確認できます。`}</p>
  <div className={styles.tableWrap}><table className={styles.table}><caption>{date||'日付準備中'}・{race}R の個別診断（自動更新なし）</caption><thead><tr><th scope="col">場</th><th scope="col">実装・接続</th><th scope="col">直線項目</th><th scope="col">今回の取得結果</th><th scope="col">確認</th></tr></thead><tbody>{shown.map(v=>{
   const result=results[key(v.code)],status=result?diagnosticStatus(result.body):null;
   return <tr key={v.code}><th scope="row">{String(v.code).padStart(2,'0')} {v.name}</th><td><span className={styles.badge}>{v.stage}</span><small>{v.note}</small></td><td>{v.straightAbsent?'対象項目なし':v.endpoint?'取得対象':'未確認'}</td><td>{status?<><span className={`${styles.badge} ${styles[status.tone]}`}>{status.label}</span><small>{status.detail}</small><small>{result.requested.date}・{result.requested.race}R / 確認 {new Date(result.checkedAt).toLocaleTimeString('ja-JP',{timeZone:'Asia/Tokyo'})} JST</small>{result.body.error&&<small>詳細：{result.body.error}</small>}<details><summary>取得値・照合情報</summary><pre style={{maxWidth:360,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({identity:result.body.identity,rows:result.body.candidateRows||result.body.rows,fetchedAt:result.body.fetchedAt,blockingReasons:result.body.blockingReasons},null,2)}</pre></details></>:<span className={styles.badge}>未確認</span>}</td><td><button className={styles.button} disabled={!v.endpoint||!date||busy!==null} onClick={()=>check(v)} aria-label={`${v.name} ${race}Rを確認`}>{busy===v.code?'確認中…':v.endpoint?'取得確認':'診断未接続'}</button></td></tr>;
  })}</tbody></table></div>
 </div></main>;
}
