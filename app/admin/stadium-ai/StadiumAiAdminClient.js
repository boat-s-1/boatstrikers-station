'use client';
import {useState} from 'react';
import styles from './stadiumAiAdmin.module.css';
export default function StadiumAiAdminClient(){
 const [date,setDate]=useState(new Date().toISOString().slice(0,10)); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
 async function refresh(){setBusy(true);setMessage('');try{const res=await fetch('/api/admin/stadium-ai/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({course_code:1,as_of:date})});const json=await res.json();if(!res.ok)throw new Error(json.error||'失敗しました');setMessage(`桐生を更新しました。対象 ${json.payload?.race_count??0}R`);}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 return <div className={styles.card}><span>BOATSTRIKERS STADIUM AI</span><h1>場別データ集計</h1><p>直近1年の桐生データと、最新日の当日評価を再集計します。</p><label>集計基準日<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><button onClick={refresh} disabled={busy}>{busy?'集計中…':'桐生を再集計'}</button>{message&&<div className={styles.message}>{message}</div>}<a href="/library/stadium/kiryu?preview=premium">プレミアム表示を確認 →</a></div>
}
