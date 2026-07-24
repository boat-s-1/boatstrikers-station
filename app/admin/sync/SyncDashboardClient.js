"use client";
import { useCallback, useEffect, useState } from "react";
import styles from "./sync.module.css";

const COMMANDS = [
  ["full", "今すぐ全同期"], ["entries", "出走表だけ"], ["exhibition", "展示だけ"],
  ["results", "結果だけ"], ["payouts", "払戻だけ"], ["health", "診断だけ"],
];
const courseNames = ["", "桐生", "戸田", "江戸川", "平和島", "多摩川", "浜名湖", "蒲郡", "常滑", "津", "三国", "びわこ", "住之江", "尼崎", "鳴門", "丸亀", "児島", "宮島", "徳山", "下関", "若松", "芦屋", "福岡", "唐津", "大村"];

function formatDate(value) { if (!value) return "-"; return new Intl.DateTimeFormat("ja-JP", { timeZone:"Asia/Tokyo", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit" }).format(new Date(value)); }
function StatusPill({ value }) { return <span className={`${styles.pill} ${styles[value] || ""}`}>{value || "unknown"}</span>; }

export default function SyncDashboardClient() {
  const [data, setData] = useState(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const load = useCallback(async()=>{ const r=await fetch("/api/admin/sync/status",{cache:"no-store"}); if(r.status===401){location.href="/admin/sync/login";return;} setData(await r.json()); },[]);
  useEffect(()=>{ load(); const id=setInterval(load,15000); return()=>clearInterval(id); },[load]);
  async function command(type){ setBusy(true); setMessage(""); const r=await fetch("/api/admin/sync/command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({commandType:type,targetDate:data?.today})}); const j=await r.json(); setMessage(r.ok?`指示を登録しました（#${j.id}）。Windows側が次回巡回時に実行します。`:j.error||"登録失敗"); setBusy(false); load(); }
  if(!data) return <main className={styles.page}><div className={styles.loading}>読み込み中...</div></main>;
  const r=data.runtime||{};
  return <main className={styles.page}>
    <header className={styles.header}><div><p>BOATSTRIKERS ULTIMATE</p><h1>Auto Sync v6.0</h1></div><div className={styles.headerActions}><button onClick={load}>更新</button><form action="/api/admin/sync/logout" method="post"><button>ログアウト</button></form></div></header>
    {message&&<div className={styles.notice}>{message}</div>}
    <section className={styles.cards}>
      <article className={styles.card}><span>同期状態</span><strong><StatusPill value={r.state}/></strong><small>{r.current_mode?`実行中: ${r.current_mode}`:"待機中"}</small></article>
      <article className={styles.card}><span>最終成功</span><strong>{formatDate(r.last_success_at)}</strong><small>Heartbeat: {formatDate(r.heartbeat_at)}</small></article>
      <article className={styles.card}><span>本日の開催</span><strong>{data.counts.events} R</strong><small>{data.counts.entries} 艇</small></article>
      <article className={styles.card}><span>公開状況</span><strong>{data.counts.exhibition} 展示</strong><small>{data.counts.results} 結果</small></article>
    </section>
    <section className={styles.panel}><div className={styles.panelTitle}><div><p>MANUAL CONTROL</p><h2>手動同期</h2></div><span>指示はSupabaseに登録され、Windowsエンジンが処理します。</span></div><div className={styles.commandGrid}>{COMMANDS.map(([key,label])=><button disabled={busy||r.state==="running"} key={key} onClick={()=>command(key)}>{label}</button>)}</div></section>
    <section className={styles.panel}><div className={styles.panelTitle}><div><p>COURSE MONITOR</p><h2>24場の公開状況</h2></div></div><div className={styles.courseGrid}>{data.courses.map(c=><div className={styles.course} key={c.course_code}><b>#{String(c.course_code).padStart(2,"0")} {courseNames[c.course_code]}</b><span>{c.result_count>0?"結果公開":c.exhibition_count>0?"展示公開":"出走表"}</span><small>{c.event_count}R / 展示{c.exhibition_count} / 結果{c.result_count}</small></div>)}</div></section>
    <div className={styles.twoColumns}><section className={styles.panel}><div className={styles.panelTitle}><div><p>COMMAND QUEUE</p><h2>操作履歴</h2></div></div><div className={styles.list}>{data.commands.map(x=><div className={styles.row} key={x.id}><div><b>#{x.id} {x.command_type}</b><small>{formatDate(x.requested_at)}</small></div><StatusPill value={x.status}/></div>)}</div></section>
    <section className={styles.panel}><div className={styles.panelTitle}><div><p>SYNC LOG</p><h2>同期履歴</h2></div></div><div className={styles.list}>{data.logs.map(x=><div className={styles.row} key={x.id}><div><b>{x.sync_type}</b><small>{formatDate(x.started_at)} / {x.message||"-"}</small></div><StatusPill value={x.status}/></div>)}</div></section></div>
  </main>;
}
