"use client";
import {useMemo} from "react";
import {buildBscExhibition} from "../../lib/bscExhibition";
import styles from "../phase2.module.css";

const f=(v,d=2)=>v===null||v===undefined?"-":Number(v).toFixed(d);
const n=v=>String(v||"選手名未取得").replace(/\u3000/g," ").trim();

export default function BscExhibitionPanel({entries}){
  const rows=useMemo(()=>buildBscExhibition(entries),[entries]);
  if(!rows.some(x=>x.exhibition_time!==null)) return <div className={styles.emptyAi}>
    <div className={styles.emptyAiIcon}>⏱️</div><h3>BSC展示はまだありません</h3>
    <p>展示取得後、5分同期で自動計算されます。</p></div>;

  return <>
    <div className={styles.panelHeading}><div><p>BOATSTRIKERS EXHIBITION</p>
      <h2>BSCオリジナル展示</h2></div><span className={styles.panelBadge}>研究版</span></div>
    <div className={styles.exhibitionList}>
      {[...rows].sort((a,b)=>a.bscExhibitionRank-b.bscExhibitionRank).map(x=>
        <article className={styles.exhibitionRow} key={x.boat_no}>
          <span className={`${styles.boatBadge} ${styles[`boat${x.boat_no}`]}`}>{x.boat_no}</span>
          <div className={styles.exhibitionRacer}><strong>{n(x.racer_name)}</strong>
            <span>公式 {f(x.exhibition_time)} / ST {f(x.exhibition_st)}</span></div>
          <div className={styles.exhibitionValue}><small>BSC指数</small><strong>{x.bscExhibitionScore}</strong></div>
          <div className={styles.exhibitionValue}><small>評価</small><strong>{x.bscExhibitionGrade}</strong></div>
          <span className={styles.rankBadge}>{x.bscExhibitionRank}位</span>
          {x.reasons.length>0&&<div style={{gridColumn:"1 / -1",display:"flex",gap:5,flexWrap:"wrap"}}>
            {x.reasons.map(r=><small key={r} style={{padding:"4px 7px",borderRadius:999,background:"#eef6fb"}}>{r}</small>)}
          </div>}
        </article>)}
    </div>
    <p className={styles.aiDisclaimer}>※ BSC展示指数は独自の研究用評価で、実測タイムではありません。</p>
  </>;
}
