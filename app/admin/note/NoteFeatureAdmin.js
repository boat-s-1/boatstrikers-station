"use client";
import { useEffect, useState } from "react";
import styles from "./note.module.css";

const courses = ["桐生","戸田","江戸川","平和島","多摩川","浜名湖","蒲郡","常滑","津","三国","びわこ","住之江","尼崎","鳴門","丸亀","児島","宮島","徳山","下関","若松","芦屋","福岡","唐津","大村"];
const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const empty = { race_date:today, course_code:1, race_no:1, character_name:"一果", feature_title:"詳細分析公開中", teaser_text:"前日データ・狙い目・危険ポイントを詳しく解説しています。", note_url:"", is_published:false, is_pickup:false, sort_order:100 };

export default function NoteFeatureAdmin(){
 const [form,setForm]=useState(empty),[items,setItems]=useState([]),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function load(date=form.race_date){ const r=await fetch(`/api/admin/note-features?date=${date}`,{cache:"no-store"}); if(r.status===401){location.href="/admin/sync/login";return;} const j=await r.json(); setItems(j.items||[]); }
 useEffect(()=>{load(form.race_date)},[]);
 function change(e){const {name,value,type,checked}=e.target;setForm(v=>({...v,[name]:type==="checkbox"?checked:value}));}
 async function save(e){e.preventDefault();setBusy(true);setMessage("");const r=await fetch("/api/admin/note-features",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});const j=await r.json();setBusy(false);setMessage(r.ok?"保存しました。":j.error||"保存に失敗しました。");if(r.ok)load();}
 function edit(x){setForm({...x});scrollTo({top:0,behavior:"smooth"});}
 async function remove(id){if(!confirm("削除しますか？"))return;await fetch(`/api/admin/note-features?id=${id}`,{method:"DELETE"});load();}
 return <>
  <header className={styles.header}><div><span>ULTIMATE v12.0</span><h1>note詳細版 管理</h1><p>一部レースだけに「詳細分析公開中」とPICK UP導線を付けます。</p></div><a href="/admin/sync">同期管理へ</a></header>
  <form className={styles.form} onSubmit={save}>
   <div className={styles.grid}>
    <label>開催日<input type="date" name="race_date" value={form.race_date} onChange={e=>{change(e);setTimeout(()=>load(e.target.value),0)}} required/></label>
    <label>場<select name="course_code" value={form.course_code} onChange={change}>{courses.map((n,i)=><option value={i+1} key={n}>{String(i+1).padStart(2,"0")} {n}</option>)}</select></label>
    <label>レース<select name="race_no" value={form.race_no} onChange={change}>{Array.from({length:12},(_,i)=><option value={i+1} key={i}>{i+1}R</option>)}</select></label>
    <label>担当<input name="character_name" value={form.character_name} onChange={change}/></label>
   </div>
   <label>見出し<input name="feature_title" value={form.feature_title} onChange={change}/></label>
   <label>紹介文<textarea name="teaser_text" value={form.teaser_text||""} onChange={change} rows="3"/></label>
   <label>note URL<input type="url" name="note_url" placeholder="https://note.com/..." value={form.note_url||""} onChange={change}/></label>
   <div className={styles.checks}><label><input type="checkbox" name="is_published" checked={!!form.is_published} onChange={change}/> 詳細版を公開</label><label><input type="checkbox" name="is_pickup" checked={!!form.is_pickup} onChange={change}/> 今日のPICK UPに表示</label></div>
   <div className={styles.actions}><button disabled={busy}>{busy?"保存中...":"保存する"}</button><button type="button" className={styles.sub} onClick={()=>setForm({...empty,race_date:form.race_date})}>新規入力</button><span>{message}</span></div>
  </form>
  <section className={styles.list}><h2>{form.race_date} の登録レース</h2>{items.length===0?<p>登録はありません。</p>:items.map(x=><article key={x.id}><div><b>{courses[x.course_code-1]} {x.race_no}R</b><span>{x.is_published?"公開中":"非公開"}{x.is_pickup?"・PICK UP":""}</span><small>{x.feature_title}</small></div><div><button onClick={()=>edit(x)}>編集</button><button onClick={()=>remove(x.id)}>削除</button></div></article>)}</section>
 </>;
}
