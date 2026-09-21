import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getMemberEntitlementFromToken, MEMBER_ACCESS_COOKIE } from "../../lib/memberEntitlement";
import styles from "./today.module.css";
import visualStyles from "./todayVisual.module.css";
import { getPublishedNewspapers } from "../../lib/newspapers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "BoatStrikers TODAY｜今日の出来事・新着コンテンツ",
  description: "今日の誕生日選手、グレード戦、新聞、ニュース、DATA LAB、配信予定をまとめたBoatStrikersのデイリーホームです。",
  alternates: { canonical: "/today" },
};

const COURSE_NAMES={1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村"};
const CHARACTERS=[
  {key:"ichika",name:"一果",emoji:"🌿",role:"イン逃げ新聞",tone:"ichika",href:"/ichika"},
  {key:"hatsune",name:"初音",emoji:"💜",role:"女子戦新聞",tone:"hatsune",href:"/hatsune"},
  {key:"kiina",name:"キイナ",emoji:"💛",role:"5アタマ穴党新聞",tone:"kiina",href:"/kiina"},
];

function jstToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function formatDate(date){const [y,m,d]=date.split("-");return `${y}年${Number(m)}月${Number(d)}日`;}
function db(){const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});}
function raceHref(code,race,date){return `/races/${Number(code)}/${Number(race)}?date=${date}`;}

async function loadTodayData(date){
  const client=db();
  if(!client)return {grades:[],birthdays:[]};
  const [grade,birthday]=await Promise.all([
    client.from("bs_grade_race_events").select("start_date,end_date,course_code,grade,title").lte("start_date",date).gte("end_date",date).order("course_code"),
    client.rpc("bs_today_birthday_racers",{p_date:date}),
  ]);
  return {grades:grade.data||[],birthdays:birthday.data||[]};
}

async function memberState(){
  try{const store=await cookies();const token=store.get(MEMBER_ACCESS_COOKIE)?.value||"";if(!token)return {authenticated:false};return await getMemberEntitlementFromToken(token);}catch{return {authenticated:false};}
}

export default async function TodayPage(){
  const displayDate=jstToday();
  const [data,member,todayPapers]=await Promise.all([loadTodayData(displayDate),memberState(),getPublishedNewspapers({date:displayDate,limit:30})]);
  const gradeLabels=new Set(["SG","PG1","G1","G2","G3"]);
  const grades=data.grades.filter(x=>gradeLabels.has(String(x.grade||"").toUpperCase()));
  const birthdayMap=new Map();
  for(const row of data.birthdays||[]){
    const key=row.registration_no;
    if(!birthdayMap.has(key))birthdayMap.set(key,{...row,races:[]});
    birthdayMap.get(key).races.push({course_code:row.course_code,race_no:row.race_no,boat_no:row.boat_no});
  }
  const birthdayRacers=[...birthdayMap.values()];

  return <main className={`${styles.page} ${visualStyles.page}`} data-page="today">
    <section className={`${styles.hero} ${visualStyles.hero}`}>
      <div>
        <span className={styles.kicker}>BOATSTRIKERS DAILY</span>
        <h1>今日のBoatStrikers</h1>
        <p>{formatDate(displayDate)}の出来事と新着コンテンツ</p>
      </div>
      <div className={styles.heroBadges}>
        {birthdayRacers.length?<span>🎂 誕生日選手 <b>{birthdayRacers.length}人</b></span>:null}
        {grades.length?<span>🏆 グレード戦 <b>{grades.length}件</b></span>:null}
      </div>
    </section>

    <section className={`${styles.topicSection} ${visualStyles.panel}`}>
      <div className={styles.heading}><div><small>TODAY'S TOPICS</small><h2>今日のトピックス</h2></div></div>
      <div className={styles.topicGrid}>
        {birthdayRacers.length?<a href="#birthdays" className={`${styles.topicCard} ${styles.birthdayTopic}`}><span>🎂</span><div><small>HAPPY BIRTHDAY</small><strong>本日出走する誕生日選手</strong><p>{birthdayRacers.map(x=>x.name).join("・")}</p></div><b>↓</b></a>:null}
        {grades.slice(0,2).map((g,i)=><Link className={styles.topicCard} key={`${g.course_code}-${g.title}-${i}`} href={`/races/${Number(g.course_code)}?date=${displayDate}`}><span>🏆</span><div><small>{String(g.grade).toUpperCase()} / {COURSE_NAMES[Number(g.course_code)]}</small><strong>{g.title||"グレードレース開催中"}</strong><p>本日の開催情報を見る</p></div><b>›</b></Link>)}
        <Link className={`${styles.topicCard} ${styles.raceTopic}`} href={`/races?date=${displayDate}`}><span>🚤</span><div><small>RACE CENTER</small><strong>今日のレース情報</strong><p>開催場・AI注目・展示・的中速報はこちら</p></div><b>›</b></Link>
      </div>
    </section>

    {birthdayRacers.length?<section className={`${styles.section} ${visualStyles.panel}`} id="birthdays">
      <div className={styles.heading}><div><small>TODAY'S BIRTHDAYS</small><h2>今日の誕生日レーサー</h2></div></div>
      <div className={styles.birthdayGrid}>{birthdayRacers.map(r=><article className={styles.birthdayCard} key={r.registration_no}>
        <div className={styles.birthdayHead}><span aria-hidden="true">🎂</span><div><strong>{r.name}</strong><small>登録 {Number(r.registration_no)} / {r.branch||"支部未登録"} / {r.racer_class||"-"}</small></div><b>{Number(r.birthday?.slice(5,7))}/{Number(r.birthday?.slice(8,10))}</b></div>
        <div className={styles.birthdayRaces}>{r.races.map((race,i)=><Link key={`${race.course_code}-${race.race_no}-${i}`} href={raceHref(race.course_code,race.race_no,displayDate)}><span>{COURSE_NAMES[Number(race.course_code)]} {Number(race.race_no)}R</span><small>{Number(race.boat_no)}号艇</small><b>出走表 →</b></Link>)}</div>
      </article>)}</div>
    </section>:null}

    <section className={`${styles.section} ${visualStyles.panel}`}>
      <div className={styles.heading}><div><small>TODAY'S BOATSTRIKERS</small><h2>今日のBoatStrikers</h2></div><Link href="/library">過去の記事を見る ›</Link></div>
      <div className={styles.paperGrid}>{todayPapers.length ? todayPapers.map((item)=>{const ch=CHARACTERS.find(x=>x.key===item.character_key)||CHARACTERS[0];return <Link href={`/newspapers/${item.slug}`} className={`${styles.paper} ${styles[ch.tone]}`} key={item.id}><span>{ch.emoji}</span><div><small>{ch.name}・{item.edition==="just_before"?"直前版":"前日版"}</small><strong>{item.course_name}{item.race_no}R</strong><p>{item.title}</p></div><b>読む ›</b></Link>}) : CHARACTERS.map(ch=><Link href={ch.href} className={`${styles.paper} ${styles[ch.tone]}`} key={ch.key}><span>{ch.emoji}</span><div><small>{ch.role}</small><strong>{ch.name}の新聞</strong><p>本日の新聞は準備中です</p></div><b>見る ›</b></Link>)}</div>
      <div className={styles.mediaGrid}>
        <Link href="/data-lab"><span>📊</span><div><small>DATA LAB</small><strong>昨日を数字で振り返る</strong></div><b>›</b></Link>
        <Link href="/news"><span>📰</span><div><small>NEWS</small><strong>今日のニュースを読む</strong></div><b>›</b></Link>
        <Link href="/schedule"><span>🎙️</span><div><small>SCHEDULE</small><strong>今日の配信予定を見る</strong></div><b>›</b></Link>
      </div>
    </section>

    {grades.length?<section className={`${styles.section} ${visualStyles.panel}`}><div className={styles.heading}><div><small>EVENTS</small><h2>今日のグレード戦</h2></div></div><div className={styles.gradeGrid}>{grades.map((g,i)=><Link className={styles.grade} key={`${g.course_code}-${g.title}-${i}`} href={`/races/${Number(g.course_code)}?date=${displayDate}`}><span>{String(g.grade).toUpperCase()}</span><div><strong>{g.title||"グレードレース"}</strong><small>{COURSE_NAMES[Number(g.course_code)]}</small></div><b>開催情報 ›</b></Link>)}</div></section>:null}

    <section className={styles.raceCta}><div><small>RACE CENTER</small><h2>レースを探す・見る</h2><p>全開催場の出走表、展示、AI注目、理論アラート、的中速報はレースページにまとめています。</p></div><Link href={`/races?date=${displayDate}`}>今日のレースを見る →</Link></section>

    {!member.authenticated?<section className={styles.cta}><div><small>FREE MEMBER</small><h2>無料会員で、もっと便利に</h2><p>会員向け機能や通知を活用できます。</p></div><Link href="/members">無料会員になる →</Link></section>:<section className={styles.memberMini}><span>✓ 会員ログイン中</span><Link href="/members">会員メニュー ›</Link></section>}
  </main>;
}
