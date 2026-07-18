import Link from "next/link";
import {formatSyncedAt,getAvailableDates,getCoursesByDate,normalizeDate} from "../lib/boatstrikersLive";
import s from "./live.module.css";
export const dynamic="force-dynamic";
export default async function Page({searchParams}){
 const q=await searchParams; const date=normalizeDate(q?.date); let courses=[],dates=[],err=null;
 try{[courses,dates]=await Promise.all([getCoursesByDate(date),getAvailableDates()]);}catch(e){console.error(e);err=e.message;}
 return <main className={s.page}>
  <header className={s.hero}><div className={s.inner}><div className={s.top}><Link className={s.pill} href="/">← ホーム</Link></div><div className={s.title}><div className={s.icon}>🚤</div><div><p className={s.eyebrow}>BOATSTRIKERS LIVE</p><h1>開催場一覧</h1><p className={s.desc}>PC-KYOTEIから同期した実際の出走データ</p><div className={s.metaRow}><span className={s.meta}>{date}</span><span className={s.meta}>{courses.length}場開催</span></div></div></div></div></header>
  <section className={s.content}>
   {!!dates.length&&<nav className={s.dateNav}>{dates.map(d=><Link key={d} href={`/races?date=${d}`} className={`${s.dateLink} ${d===date?s.dateActive:""}`}>{d}</Link>)}</nav>}
   <div className={s.sectionHead}><div><p>TODAY&apos;S COURSES</p><h2>開催場を選択</h2></div><span className={s.badge}>{courses.length}場</span></div>
   {err?<div className={s.error}><span>⚠️</span><h2>取得できませんでした</h2><p>{err}</p></div>:!courses.length?<div className={s.empty}><span>🚤</span><h2>この日のデータはありません</h2><p>今回の確認用データは2024-06-01です。</p></div>:<div className={s.grid}>{courses.map(c=><article className={s.card} key={c.courseCode}><div className={s.cardTop}><div className={s.courseTitle}><span className={s.code}>{String(c.courseCode).padStart(2,"0")}</span><h2>{c.courseName}</h2></div><span className={s.live}>出走表公開</span></div><div className={s.info}><div><span>レース</span><strong>{c.raceCount}R</strong></div><div><span>展示公開</span><strong>{c.exhibitionCount}R</strong></div><div><span>最終同期</span><strong>{formatSyncedAt(c.syncedAt)}</strong></div></div><Link className={s.primary} href={`/races/${String(c.courseCode).padStart(2,"0")}?date=${date}`}><span>1R〜12Rを見る</span><span>→</span></Link></article>)}</div>}
  </section>
 </main>;
}
