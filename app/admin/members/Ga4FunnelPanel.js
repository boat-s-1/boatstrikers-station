import crypto from "node:crypto";
import styles from "./ga4Funnel.module.css";

const PROPERTY_ID=process.env.GA4_PROPERTY_ID||"544144846";
const CLIENT_EMAIL=process.env.GA4_CLIENT_EMAIL||"";
const PRIVATE_KEY=(process.env.GA4_PRIVATE_KEY||"").replace(/\\n/g,"\n");

const TODAY_STAGES=[
  {key:"today",label:"TODAY閲覧",event:"today_view"},
  {key:"race",label:"TODAY → レース",event:"today_race_click"},
  {key:"cta",label:"無料会員CTA",event:"race_member_cta_click"},
  {key:"members",label:"会員ページ到達",event:"members_view"},
  {key:"signup",label:"会員登録",event:"sign_up"},
  {key:"memberToday",label:"登録後・会員 → TODAY",event:"member_today_click"},
  {key:"lineStart",label:"LINE連携開始",event:"line_link_start"},
  {key:"line",label:"LINE連携完了",event:"line_link_complete"},
];

const LEGACY_STAGES=[
  {key:"visitors",label:"訪問者",event:null},
  {key:"race",label:"レース閲覧",event:"race_entry_click"},
  {key:"ai",label:"AI利用",event:"ai_feature_use"},
  {key:"signup",label:"会員登録",event:"sign_up"},
  {key:"line",label:"LINE連携",event:"line_link_complete"},
  {key:"discord",label:"Discord連携",event:"discord_link_complete"},
  {key:"premium",label:"PREMIUM導線",event:"premium_cta_click"},
];

const EVENT_NAMES=[...new Set([...TODAY_STAGES,...LEGACY_STAGES].map(stage=>stage.event).filter(Boolean))];

function enc(value){return Buffer.from(value).toString("base64url");}

async function getGoogleAccessToken(){
  const now=Math.floor(Date.now()/1000);
  const header=enc(JSON.stringify({alg:"RS256",typ:"JWT"}));
  const payload=enc(JSON.stringify({iss:CLIENT_EMAIL,scope:"https://www.googleapis.com/auth/analytics.readonly",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600}));
  const unsigned=`${header}.${payload}`;
  const signer=crypto.createSign("RSA-SHA256");
  signer.update(unsigned);signer.end();
  const assertion=`${unsigned}.${signer.sign(PRIVATE_KEY).toString("base64url")}`;
  const body=new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion});
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body,cache:"no-store"});
  if(!response.ok)throw new Error(`Google OAuth ${response.status}`);
  const data=await response.json();
  if(!data?.access_token)throw new Error("Google OAuth token missing");
  return data.access_token;
}

async function runReport(token,request){
  const response=await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(request),cache:"no-store"});
  if(!response.ok){const text=await response.text().catch(()=>"");throw new Error(`GA4 Data API ${response.status}${text?`: ${text.slice(0,180)}`:""}`);}
  return response.json();
}

function metricValue(row,index=0){return Number(row?.metricValues?.[index]?.value||0);}

function buildStages(definitions,map,visitors=0,sessions=0){
  return definitions.map(stage=>stage.event
    ?{...stage,users:map.get(stage.event)?.users||0,events:map.get(stage.event)?.events||0}
    :{...stage,users:visitors,events:sessions});
}

async function loadPeriod(token,startDate){
  const [overview,events]=await Promise.all([
    runReport(token,{dateRanges:[{startDate,endDate:"today"}],metrics:[{name:"totalUsers"},{name:"sessions"}]}),
    runReport(token,{dateRanges:[{startDate,endDate:"today"}],dimensions:[{name:"eventName"}],metrics:[{name:"totalUsers"},{name:"eventCount"}],dimensionFilter:{filter:{fieldName:"eventName",inListFilter:{values:EVENT_NAMES}}}}),
  ]);
  const map=new Map((events.rows||[]).map(row=>[row.dimensionValues?.[0]?.value,{users:metricValue(row,0),events:metricValue(row,1)}]));
  const visitors=metricValue(overview.rows?.[0],0);
  const sessions=metricValue(overview.rows?.[0],1);
  return {
    visitors,sessions,
    todayStages:buildStages(TODAY_STAGES,map),
    legacyStages:buildStages(LEGACY_STAGES,map,visitors,sessions),
  };
}

function pct(n,d){if(!d)return "—";return `${((n/d)*100).toFixed(1)}%`;}

async function loadGa4(){
  if(!CLIENT_EMAIL||!PRIVATE_KEY)return {configured:false,error:null};
  try{
    const token=await getGoogleAccessToken();
    const [week,month]=await Promise.all([loadPeriod(token,"7daysAgo"),loadPeriod(token,"30daysAgo")]);
    return {configured:true,error:null,week,month};
  }catch(error){console.error("[GA4 funnel]",error);return {configured:true,error:error instanceof Error?error.message:"GA4データを取得できませんでした。"};}
}

function Funnel({stages,mode="users",sessions=0}){
  return <div className={styles.funnel}>
    {stages.map((stage,index)=>{
      const previous=index===0?null:stages[index-1];
      const value=mode==="events"?stage.events:stage.users;
      const previousValue=previous?(mode==="events"?previous.events:previous.users):0;
      return <article key={stage.key} className={styles.stage}>
        <span>{stage.label}</span>
        <strong>{value.toLocaleString("ja-JP")}</strong>
        <small>{index===0?(mode==="events"?"イベント件数":`${sessions.toLocaleString("ja-JP")}セッション`):`前段階比 ${pct(value,previousValue)}`}</small>
      </article>;
    })}
  </div>;
}

function Period({title,data}){
  return <>
    <div className={styles.periodTitle}><strong>{title}・TODAY → 会員登録</strong><span>GA4 event count</span></div>
    <Funnel stages={data.todayStages} mode="events" />
    <p className={styles.note}>※ 前段階比はイベント件数の単純比率による参考CVRです。同一ユーザーが順番に進んだことを保証するコホートファネルではありません。</p>
    <div className={styles.periodTitle}><strong>{title}・従来ファネル</strong><span>GA4 unique users</span></div>
    <Funnel stages={data.legacyStages} mode="users" sessions={data.sessions} />
  </>;
}

export default async function Ga4FunnelPanel(){
  const data=await loadGa4();
  return <section className={styles.section}>
    <div className={styles.heading}><div><span>GA4 FUNNEL</span><h2>TODAY → 会員化ファネル</h2><p>TODAY閲覧からレース、無料会員CTA、登録、TODAY再訪、LINE連携までを匿名イベントで確認します。従来ファネルも下段に維持します。</p></div><div className={styles.measurement}>G-DXF6FFZ574</div></div>
    {!data.configured&&<div className={styles.notice}><strong>GA4読み取り設定待ち</strong><p>画面は実装済みです。Vercelに <code>GA4_CLIENT_EMAIL</code> と <code>GA4_PRIVATE_KEY</code> を設定すると自動で実データ表示に切り替わります。Property ID は {PROPERTY_ID} を使用します。</p></div>}
    {data.error&&<div className={styles.error}>GA4取得エラー: {data.error}</div>}
    {data.week&&<><Period title="直近7日" data={data.week}/><Period title="直近30日" data={data.month}/><p className={styles.note}>※ GA4へメールアドレス、LINE user ID、Supabase user ID、token、氏名、LINE連携コードは送信しません。既存イベント名は維持しています。</p></>}
  </section>;
}
