"use client";
import styles from "../phase2.module.css";

const st=v=>v===null||v===undefined?"-":Number(v).toFixed(2);
const payout=v=>v===null||v===undefined?"-":`${Number(v).toLocaleString("ja-JP")}円`;

export default function RaceResultPanel({result,resultEntries,entries}){
  if(!result||!resultEntries?.length) return <div className={styles.emptyAi}>
    <div className={styles.emptyAiIcon}>🏁</div><h3>結果はまだありません</h3>
    <p>レース終了後、PC-KYOTEI反映後に自動表示されます。</p></div>;

  const names=new Map((entries||[]).map(x=>[Number(x.boat_no),x.racer_name]));
  const rows=[...resultEntries].sort((a,b)=>(a.arrival_order??99)-(b.arrival_order??99));

  return <>
    <div className={styles.panelHeading}><div><p>RACE RESULT</p><h2>レース結果</h2></div>
      <span className={styles.panelBadge}>確定</span></div>
    <div className={styles.predictionHero}>
      <div><span className={styles.aiEyebrow}>TRIFECTA</span>
        <h3>{result.trifecta_result||"-"}</h3><small>決まり手 {result.winning_method||"-"}</small></div>
      <div style={{textAlign:"right"}}><small>払戻</small>
        <strong style={{display:"block",fontSize:25}}>{payout(result.trifecta_payout)}</strong></div>
    </div>
    <div className={styles.exhibitionList} style={{marginTop:12}}>
      {rows.map(x=><article className={styles.exhibitionRow} key={x.boat_no}>
        <span className={`${styles.boatBadge} ${styles[`boat${x.boat_no}`]}`}>{x.boat_no}</span>
        <div className={styles.exhibitionRacer}><strong>{String(names.get(Number(x.boat_no))||"選手名未取得").replace(/\u3000/g," ").trim()}</strong>
          <span>{x.arrival_order??"-"}着</span></div>
        <div className={styles.exhibitionValue}><small>進入</small><strong>{x.actual_course??"-"}</strong></div>
        <div className={styles.exhibitionValue}><small>ST</small><strong>{st(x.actual_start_timing)}</strong></div>
        <span className={styles.rankBadge}>{x.arrival_order?`${x.arrival_order}着`:"-"}</span>
      </article>)}
    </div>
  </>;
}
