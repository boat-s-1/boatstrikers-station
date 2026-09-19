import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getCoursesByDate } from "../../lib/boatstrikersPlatform";
import { getMemberEntitlementFromToken, MEMBER_ACCESS_COOKIE } from "../../lib/memberEntitlement";
import styles from "./today.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "BoatStrikers TODAY｜今日の開催・注目レース・グレード戦",
  description: "今日の開催場、3人の注目レース、グレード戦、新聞、DATA LABを一画面で確認できるBoatStrikersのデイリーダッシュボードです。",
  alternates: { canonical: "/today" },
};

const COURSE_NAMES={1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村"};
const CHARACTERS=[
  {key:"ichika",name:"一果",emoji:"🌿",role:"イン逃げ・1コース中心",types:["ichika_escape_best10"],tone:"ichika",href:"/ichika"},
  {key:"hatsune",name:"初音",emoji:"💜",role:"女子戦中心",types:["hatsune_dominant_best3","hatsune_risky_best3"],tone:"hatsune",href:"/hatsune"},
  {key:"kiina",name:"キイナ",emoji:"💛",role:"5アタマ・穴狙い中心",types:["kiina_boat5_best5"],tone:"kiina",href:"/kiina"},
];
const PICK_LABELS={ichika_escape_best10:"イン逃げ期待",hatsune_dominant_best3:"イン優勢",hatsune_risky_best3:"イン注意",kiina_boat5_best5:"5アタマ期待"};

function jstToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function formatDate(date){const [y,m,d]=date.split("-");return `${y}年${Number(m)}月${Number(d)}日`;}
function db(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
function raceHref(code,race,date){return `/races/${Number(code)}/${Number(race)}?date=${date}`;}
function latestCourseSync(courses){const values=(courses||[]).flatMap(c=>[c.syncedAt,c.apiSyncedAt,c.exhibitionSyncedAt]).filter(Boolean).map(v=>new Date(v).getTime()).filter(Number.isFinite);return values.length?new Date(Math.max(...values)).toISOString():null;}

async function loadTodayData(date){
  const client=db();
  const coursesPromise=getCoursesByDate(date).catch(()=>[]);
  if(!client){const courses=await coursesPromise;return {courses,rankings:[],grades:[],updatedAt:latestCourseSync(courses)};}
  const [courses,rank,grade]=await Promise.all([
    coursesPromise,
    client.from("ai_v2_daily_rankings").select("ranking_type,rank_no,course_code,race_no,selected_for_home,data_timing").eq("ranking_date",date).in("ranking_type",CHARACTERS.flatMap(x=>x.types)).in("data_timing",["previous_day","after_exhibition"]).order("rank_no"),
    client.from("bs_grade_race_events").select("start_date,end_date,course_code,grade,title").lte("start_date",date).gte("end_date",date).order("course_code"),
  ]);
  const safeCourses=Array.isArray(courses)?courses:[];
  return {courses:safeCourses,rankings:rank.data||[],grades:grade.data||[],updatedAt:latestCourseSync(safeCourses)};
}

function characterPicks(rows,character){
  const selected=rows.filter(x=>character.types.includes(x.ranking_type)&&x.selected_for_home===true);
  const byRace=new Map();
  for(const row of selected){
    const key=`${Number(row.course_code)}:${Number(row.race_no)}`;
    const current=byRace.get(key);
    if(!current||row.data_timing==="after_exhibition")byRace.set(key,row);
  }
  return [...byRace.values()].sort((a,b)=>Number(a.rank_no)-Number(b.rank_no)).slice(0,3);
}

async function memberState(){
  try{const store=await cookies();const token=store.get(MEMBER_ACCESS_COOKIE)?.value||"";if(!token)return {authenticated:false};return await getMemberEntitlementFromToken(token);}catch{return {authenticated:false};}
}

export default async function TodayPage(){
  const displayDate=jstToday();
  const [data,member]=await Promise.all([loadTodayData(displayDate),memberState()]);
  const gradeLabels=new Set(["SG","PG1","G1","G2","G3"]);
  const grades=data.grades.filter(x=>gradeLabels.has(String(x.grade||"").toUpperCase()));
  const updateText=data.updatedAt?new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",hour:"2-digit",minute:"2-digit"}).format(new Date(data.updatedAt)):null;

  return <main className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroLead}>
        <span className={styles.kicker}>DAILY COMMAND CENTER</span>
        <h1 className={styles.srOnly}>BoatStrikers TODAY</h1>
        <img
          src="/todayrace.png"
          alt="今日のレースを見る"
          className={styles.heroBanner}
        />
        <p>{formatDate(displayDate)}</p>
      </div>
      {(data.courses.length||grades.length||updateText)?<div className={styles.metrics}>{data.courses.length?<span><b>{data.courses.length}</b>開催場</span>:null}{grades.length?<span><b>{grades.length}</b>グレード戦</span>:null}{updateText?<span><b>{updateText}</b>データ更新</span>:null}</div>:null}
    </section>

    <section className={styles.section}>
      <div className={styles.heading}><div><small>TODAY'S STADIUMS</small><h2>今日の開催場</h2></div><Link href={`/races?date=${displayDate}`}>全場を見る ›</Link></div>
      {data.courses.length?<div className={styles.courseGrid}>{data.courses.map(c=><Link className={styles.course} key={c.courseCode} href={`/races/${Number(c.courseCode)}?date=${displayDate}`}><span>#{String(c.courseCode).padStart(2,"0")}</span><strong>{c.courseName||COURSE_NAMES[Number(c.courseCode)]}</strong>{Number(c.resultCount||0)>0?<small>{Number(c.resultCount)}/{Number(c.raceCount||12)}R 結果取得</small>:null}</Link>)}</div>:<p className={styles.empty}>本日の開催場データはまだありません。</p>}
    </section>

    <section className={styles.section}>
      <div className={styles.heading}><div><small>CHARACTER PICKS</small><h2>今日の注目レース</h2></div></div>
      <div className={styles.characterGrid}>{CHARACTERS.map(ch=>{const picks=characterPicks(data.rankings,ch);return <article className={`${styles.character} ${styles[ch.tone]}`} key={ch.key}><div className={styles.characterHead}><span>{ch.emoji}</span><div><h3>{ch.name}</h3><p>{ch.role}</p></div></div>{picks.length?<div className={styles.pickList}>{picks.map((p,i)=><Link key={`${p.course_code}-${p.race_no}-${i}`} href={raceHref(p.course_code,p.race_no,displayDate)}><span>{COURSE_NAMES[Number(p.course_code)]} {Number(p.race_no)}R <small>{PICK_LABELS[p.ranking_type]}</small></span><b>レースを見る →</b></Link>)}</div>:<div className={styles.noPick}>本日の公開候補はまだありません。</div>}<Link className={styles.characterLink} href={ch.href}>{ch.name}のページへ ›</Link></article>})}</div>
    </section>

    {grades.length?<section className={styles.section}><div className={styles.heading}><div><small>GRADE RACES</small><h2>今日のグレード戦</h2></div></div><div className={styles.gradeGrid}>{grades.map((g,i)=><Link className={styles.grade} key={`${g.course_code}-${g.title}-${i}`} href={`/races/${Number(g.course_code)}?date=${displayDate}`}><span>{String(g.grade).toUpperCase()}</span><div><strong>{g.title||"グレードレース"}</strong><small>{COURSE_NAMES[Number(g.course_code)]}</small></div><b>›</b></Link>)}</div></section>:null}

    <section className={styles.section}><div className={styles.heading}><div><small>NEWSPAPERS</small><h2>最新新聞</h2></div></div><div className={styles.paperGrid}>{CHARACTERS.map(ch=><Link href={ch.href} className={`${styles.paper} ${styles[ch.tone]}`} key={ch.key}><span>{ch.emoji}</span><div><strong>{ch.name}の新聞</strong><small>{ch.role}</small></div><b>読む ›</b></Link>)}</div></section>

    <section className={styles.lab}><small>BOATSTRIKERS DATA LAB</small><h2>今日の数字を見る</h2><p>BoatStrikersの独自研究・検証データへ。TODAYでは入口だけに絞り、詳しい分析はDATA LABで確認できます。</p><Link href="/data-lab">DATA LABを見る →</Link></section>

    {!member.authenticated?<section className={styles.cta}><div><small>FREE MEMBER</small><h2>BoatStrikersをもっと便利に</h2><p>無料会員になって、会員向け機能や通知を活用できます。</p></div><Link href="/members">無料会員になる →</Link></section>:<section className={styles.memberMini}><span>✓ 会員ログイン中</span><Link href="/members">会員メニュー ›</Link></section>}
  </main>;
}
