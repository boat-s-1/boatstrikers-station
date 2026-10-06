"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./HomeBroadcastPanel.module.css";
import entryStyles from "./HomeEntryCta.module.css";
import { getProgramPresetByTitle } from "../../lib/programPresets";

const TYPE_LABELS = { radio:"ラジオ", short:"ショート動画", note:"note", live:"生放送", comic:"コミック", other:"お知らせ" };

function jstParts(date = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(date);
  const o = Object.fromEntries(p.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  return { date:`${o.year}-${o.month}-${o.day}`, minutes:Number(o.hour)*60+Number(o.minute) };
}
function mins(value){ const [h,m]=String(value||"00:00").slice(0,5).split(":").map(Number); return h*60+m; }

export default function HomeBroadcastPanel({ tickerItems = [], scheduleItems = [], predictionEntry, membershipEntry }) {
  const [now,setNow] = useState(new Date());

  useEffect(()=>{
    const id=setInterval(()=>setNow(new Date()),30000);
    return()=>clearInterval(id);
  },[]);

  const current=jstParts(now);
  const today=useMemo(()=>scheduleItems.filter(i=>i.event_date===current.date && i.status==="published").sort((a,b)=>String(a.start_time).localeCompare(String(b.start_time))).slice(0,3),[scheduleItems,current.date]);
  const ticker=tickerItems.filter(i=>i.is_active && !/サイト(?:製作|制作)中/.test(String(i.message || "").replace(/[！!、,\s]/g, ""))).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  const text=ticker.map(i=>i.message).join("　　◆　　") || "BoatStrikersからのお知らせをこちらに表示します";

  return <section className={styles.wrap}>
    <section className={entryStyles.section} aria-labelledby="home-entry-title">
      <h2 id="home-entry-title" className={entryStyles.heading}>今日のレース・予想を見る</h2>

      <nav className={entryStyles.nav} aria-label="BoatStrikersを始める">
        <a
          href={`/races?date=${current.date}`}
          className={entryStyles.featuredBanner}
          aria-label="BoatStrikers TODAY 今日のレースを見る"
        >
          <img src="/todayrace.png" alt="BoatStrikers TODAY 今日のレースを見る" />
        </a>

        <a href="#ai-partners" className={entryStyles.card}>
          <span className={entryStyles.icon} aria-hidden="true">🔎</span>
          <strong>AI診断・キャラ予想<span>イン逃げ・5号艇・女子戦から選ぶ</span></strong>
          <b aria-hidden="true">›</b>
        </a>
      </nav>
      <a href="/guide" className={entryStyles.guide}>はじめての方へ · レースの基本と使い方 <span aria-hidden="true">›</span></a>
    </section>

    {predictionEntry}
    {membershipEntry}

    <div className={styles.ticker}>
      <strong>📢 速報</strong>
      <div className={styles.viewport}><div className={styles.track}><span>{text}</span><span aria-hidden="true">{text}</span></div></div>
    </div>


    <div className={`${styles.card} ${!today.length ? styles.compact : ""}`}>
      <header><h2>今日の配信予定</h2><a href="/schedule">番組表 ›</a></header>
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
        }):<div className={styles.empty}>
          <span>本日の配信予定はありません。</span>
        </div>}
      </div>
      {today.length > 0 && <a className={styles.more} href="/schedule">番組表をすべて見る →</a>}
    </div>

  </section>;
}
