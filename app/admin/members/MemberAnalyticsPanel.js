import { createClient } from "@supabase/supabase-js";
import styles from "./memberAnalytics.module.css";

const FEATURES={
  elimination_ai:{label:"消去法AI",limit:3},
  exhibition_compare_ai:{label:"展示比較AI",limit:3},
  ai_detail:{label:"AI詳細診断",limit:5},
};

function jstDate(date=new Date()){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}

function dayOffset(days){
  return jstDate(new Date(Date.now()-days*86400000));
}

function pct(n,d){
  return d?`${((n/d)*100).toFixed(1)}%`:"—";
}

async function loadAnalytics(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return {error:"Supabase管理接続が未設定です。"};
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const start30=dayOffset(29);
  const [{data:profiles,error:profileError},{data:usage,error:usageError},{data:events,error:eventError}]=await Promise.all([
    db.from("bs_member_profiles").select("user_id,plan,membership_status,beta_member,created_at,withdrawn_at"),
    db.from("bs_member_feature_usage_daily").select("user_id,feature_key,usage_date,usage_count").in("feature_key",Object.keys(FEATURES)).gte("usage_date",start30),
    db.from("bs_member_plan_events").select("user_id,from_plan,to_plan,changed_at").order("changed_at",{ascending:true}),
  ]);
  if(profileError)return {error:profileError.message};
  const active=(profiles||[]).filter(p=>p.membership_status==="active"&&!p.withdrawn_at);
  const rows=usageError?[]:(usage||[]);
  const planEvents=eventError?[]:(events||[]);
  const planCounts={free:0,beta:0,premium:0,other:0};
  for(const p of active){
    if(p.plan==="free")planCounts.free++;
    else if(p.plan==="beta_premium"||p.beta_member)planCounts.beta++;
    else if(p.plan==="premium"||p.plan==="plus")planCounts.premium++;
    else planCounts.other++;
  }
  const today=jstDate();
  const todayRows=rows.filter(r=>r.usage_date===today);
  const users30=new Set(rows.map(r=>r.user_id));
  const registeredTodayUsers=new Set();
  const registered7Users=new Set();
  for(const p of active){
    const created=jstDate(new Date(p.created_at));
    const createdMs=new Date(p.created_at).getTime();
    const sevenMs=createdMs+7*86400000;
    if(rows.some(r=>r.user_id===p.user_id&&r.usage_date===created))registeredTodayUsers.add(p.user_id);
    if(rows.some(r=>r.user_id===p.user_id&&new Date(`${r.usage_date}T00:00:00+09:00`).getTime()>=createdMs&&new Date(`${r.usage_date}T23:59:59+09:00`).getTime()<=sevenMs))registered7Users.add(p.user_id);
  }
  const featureStats=Object.entries(FEATURES).map(([key,def])=>{
    const t=todayRows.filter(r=>r.feature_key===key);
    const m=rows.filter(r=>r.feature_key===key);
    const exhaustedUsers=new Set(m.filter(r=>Number(r.usage_count||0)>=def.limit).map(r=>r.user_id));
    const convertedUsers=new Set();
    for(const userId of exhaustedUsers){
      const exhaustedDates=m.filter(r=>r.user_id===userId&&Number(r.usage_count||0)>=def.limit).map(r=>new Date(`${r.usage_date}T00:00:00+09:00`).getTime());
      const firstExhausted=Math.min(...exhaustedDates);
      if(planEvents.some(e=>e.user_id===userId&&["premium","plus"].includes(e.to_plan)&&new Date(e.changed_at).getTime()>=firstExhausted))convertedUsers.add(userId);
    }
    return {
      key,label:def.label,
      todayUsers:new Set(t.map(r=>r.user_id)).size,
      todayUses:t.reduce((s,r)=>s+Number(r.usage_count||0),0),
      exhausted30:exhaustedUsers.size,
      convertedAfterLimit:convertedUsers.size,
    };
  });
  const paidConversions=planEvents.filter(e=>["premium","plus"].includes(e.to_plan)&&e.from_plan==="free");
  const betaOpen=Date.now()<new Date("2027-01-01T00:00:00+09:00").getTime();
  return {
    error:null,
    activeCount:active.length,
    planCounts,
    todayUsers:new Set(todayRows.map(r=>r.user_id)).size,
    todayUses:todayRows.reduce((s,r)=>s+Number(r.usage_count||0),0),
    users30:users30.size,
    activation:{sameDay:registeredTodayUsers.size,within7:registered7Users.size,ever:users30.size},
    conversion:{betaOpen,count:paidConversions.length,rate:betaOpen?null:pct(paidConversions.length,Math.max(1,planCounts.free+paidConversions.length))},
    featureStats,
  };
}

export default async function MemberAnalyticsPanel(){
  const data=await loadAnalytics();
  if(data.error)return <section className={styles.section}><div className={styles.error}>利用分析を取得できません: {data.error}</div></section>;
  return <section className={styles.section}>
    <div className={styles.heading}>
      <div><span>MEMBER ANALYTICS</span><h2>利用・転換分析</h2><p>FREE機能の利用状況とPREMIUM転換の判断材料です。</p></div>
      <div className={styles.period}>直近30日 / 今日</div>
    </div>

    <div className={styles.kpis}>
      <article><span>FREE</span><strong>{data.planCounts.free}</strong></article>
      <article><span>β PREMIUM</span><strong>{data.planCounts.beta}</strong></article>
      <article><span>PREMIUM</span><strong>{data.planCounts.premium}</strong></article>
      <article><span>今日のAI利用者</span><strong>{data.todayUsers}</strong></article>
      <article><span>今日のAI利用回数</span><strong>{data.todayUses}</strong></article>
      <article><span>30日利用会員率</span><strong>{pct(data.users30,data.activeCount)}</strong></article>
    </div>

    <div className={styles.grid}>
      <article className={styles.card}>
        <h3>登録後の利用活性化</h3>
        <div className={styles.row}><span>登録当日にAI利用</span><b>{data.activation.sameDay}人</b><em>{pct(data.activation.sameDay,data.activeCount)}</em></div>
        <div className={styles.row}><span>登録7日以内にAI利用</span><b>{data.activation.within7}人</b><em>{pct(data.activation.within7,data.activeCount)}</em></div>
        <div className={styles.row}><span>直近30日にAI利用</span><b>{data.activation.ever}人</b><em>{pct(data.activation.ever,data.activeCount)}</em></div>
      </article>

      <article className={styles.card}>
        <h3>FREE → PREMIUM転換</h3>
        {data.conversion.betaOpen ? <div className={styles.waiting}><strong>計測開始前</strong><p>β PREMIUM無料開放中のため、有料転換率は正式課金開始後に表示します。</p></div> : <div className={styles.bigRate}>{data.conversion.rate}</div>}
      </article>
    </div>

    <div className={styles.features}>
      {data.featureStats.map(item=><article key={item.key} className={styles.feature}>
        <div className={styles.featureTitle}><strong>{item.label}</strong></div>
        <div className={styles.featureMetrics}>
          <span><b>{item.todayUsers}</b><small>今日の利用者</small></span>
          <span><b>{item.todayUses}</b><small>今日の利用回数</small></span>
          <span><b>{item.exhausted30}</b><small>30日上限到達</small></span>
          <span><b>{item.convertedAfterLimit}</b><small>到達後PREMIUM</small></span>
        </div>
      </article>)}
    </div>
    <p className={styles.note}>※ 1マークシミュレーターは未公開のため集計対象外です。未ログイン利用は現在追跡していません。</p>
  </section>;
}
