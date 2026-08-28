"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./HomeBroadcastPanel.module.css";
import { getProgramPresetByTitle } from "../../lib/programPresets";

const TYPE_LABELS = { radio:"ラジオ", short:"ショート動画", note:"note", live:"生放送", comic:"コミック", other:"お知らせ" };

function jstParts(date = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(date);
  const o = Object.fromEntries(p.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  return { date:`${o.year}-${o.month}-${o.day}`, minutes:Number(o.hour)*60+Number(o.minute) };
}
function mins(value){ const [h,m]=String(value||"00:00").slice(0,5).split(":").map(Number); return h*60+m; }

export default function HomeBroadcastPanel({ tickerItems = [], scheduleItems = [] }) {
  const [now,setNow] = useState(new Date());
  useEffect(()=>{ const id=setInterval(()=>setNow(new Date()),30000); return()=>clearInterval(id); },[]);
  const current=jstParts(now);
  const today=useMemo(()=>scheduleItems.filter(i=>i.event_date===current.date && i.status==="published").sort((a,b)=>String(a.start_time).localeCompare(String(b.start_time))).slice(0,3),[scheduleItems,current.date]);
  const ticker=tickerItems.filter(i=>i.is_active).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const text=ticker.map(i=>i.message).join("　　◆　　") || "BoatStrikersからのお知らせをこちらに表示します";

  return <section className={styles.wrap}>
    <div className={styles.ticker}>
      <strong>📢 速報</strong>
      <div className={styles.viewport}><div className={styles.track}><span>{text}</span><span aria-hidden="true">{text}</span></div></div>
    </div>
    <div className={styles.card}>
      <div className={styles.todayBannerWrap}>
        <img
          className={styles.todayBanner}
          src="/top/Untitled design.png"
          alt="今日の予定 本日の配信をチェック"
        />
      </div>
      <div className={styles.list}>
        {today.length ? today.map(item=>{
          const ended=mins(item.start_time)<current.minutes;
          const preset=getProgramPresetByTitle(item.title);
          const body=<>
            <div className={styles.time}>
              <strong>{String(item.start_time).slice(0,5)}</strong>
              <em className={ended?styles.ended:styles.upcoming}>{ended?"終了":"予定"}</em>
            </div>
            {preset&&<div className={styles.programIcon} style={{"--program-accent":preset.accent}}>{preset.iconUrl?<img src={preset.iconUrl} alt=""/>:<span>{preset.iconText}</span>}</div>}
            <div className={styles.body}>
              <div className={styles.metaRow}>
                <span>{TYPE_LABELS[item.content_type]||"お知らせ"}</span>
                {item.host&&<small>担当：{item.host}</small>}
              </div>
              <h3>{item.title}</h3>
              {item.episode&&<p>{item.episode}</p>}
              {item.link_url&&<b className={styles.miniAction}>詳しく見る <i>›</i></b>}
            </div>
          </>;
          const rowClass=`${preset?styles.hasIcon:""} ${ended?styles.past:""}`.trim();
          return item.link_url?<a key={item.id} href={item.link_url} className={rowClass}>{body}</a>:<div key={item.id} className={rowClass}>{body}</div>
        }):<div className={styles.empty}>📅 本日の予定はありません</div>}
      </div>
      <a className={styles.more} href="/schedule">番組表をすべて見る →</a>
    </div>
  </section>;
}
