"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import styles from "./members.module.css";

const LINE_ADD_URL="https://lin.ee/Pf3FEEQ";
const PLAN_LABELS={free:"FREE",beta_premium:"β PREMIUM",plus:"PLUS",premium:"PREMIUM"};
const DEFAULT_PREFS={boat4_double_top:true,ichika_escape:false,ichika_escape_surge:false,hatsune_venus:false,hatsune_box:false,triple_match:false};
const PREF_FIELDS="boat4_double_top,ichika_escape,ichika_escape_surge,hatsune_venus,hatsune_box,triple_match";
const NOTIFICATIONS=[
  {key:"boat4_double_top",icon:"🚨",title:"キイナ・4→5展開理論",text:"キイナの狙い目を通知します",active:true},
  {key:"ichika_escape",icon:"🏁",title:"一果・隠れイン理論",text:"一果の狙い目を通知します",active:true},
  {key:"ichika_escape_surge",icon:"🔥",title:"一果・イン逃げ急上昇",text:"展示1位＋一周1位で通知",active:true},
  {key:"hatsune_venus",icon:"🌸",title:"初音・女子イン崩れ理論",text:"初音の狙い目を通知します",active:true},
  {key:"hatsune_box",icon:"🎀",title:"初音・箱推し理論",text:"女子戦の箱推しBOXを通知します",active:true},
  {key:"triple_match",icon:"⭐",title:"3人一致レース",text:"一果・初音・キイナの評価が重なったレース",active:false},
];

function makeSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}

export default function MembersPage(){
  const supabase=useMemo(()=>makeSupabase(),[]);
  const [session,setSession]=useState(null);
  const [profile,setProfile]=useState(null);
  const [prefs,setPrefs]=useState(DEFAULT_PREFS);
  const [prefsBusy,setPrefsBusy]=useState("");
  const [loading,setLoading]=useState(true);
  const [mode,setMode]=useState("signup");
  const [displayName,setDisplayName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [accepted,setAccepted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [lineCode,setLineCode]=useState("");
  const [lineExpiresAt,setLineExpiresAt]=useState("");
  const [lineBusy,setLineBusy]=useState(false);

  async function loadPreferences(userId){
    if(!supabase||!userId)return;
    const {data,error:prefError}=await supabase.from("bs_member_notification_preferences").select(PREF_FIELDS).eq("user_id",userId).maybeSingle();
    if(prefError){console.error(prefError);return;}
    if(data){setPrefs({...DEFAULT_PREFS,...data});return;}
    const {data:created,error:createError}=await supabase.from("bs_member_notification_preferences").insert({user_id:userId}).select(PREF_FIELDS).single();
    if(!createError&&created)setPrefs({...DEFAULT_PREFS,...created});
  }

  async function loadProfile(userId){
    if(!supabase||!userId)return null;
    const {data,error:profileError}=await supabase.from("bs_member_profiles")
      .select("user_id,email,display_name,plan,membership_status,beta_member,terms_accepted_at,privacy_accepted_at,line_user_id,line_linked_at,created_at")
      .eq("user_id",userId).maybeSingle();
    if(profileError){setError("会員情報を読み込めませんでした。");return null;}
    setProfile(data||null);
    if(data?.line_user_id){setLineCode("");setLineExpiresAt("");}
    await loadPreferences(userId);
    return data||null;
  }

  useEffect(()=>{
    if(!supabase){setLoading(false);setError("会員機能の設定を確認しています。しばらくしてからお試しください。");return;}
    let alive=true;
    supabase.auth.getSession().then(async({data})=>{if(!alive)return;setSession(data.session||null);if(data.session)await loadProfile(data.session.user.id);setLoading(false);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange(async(_event,nextSession)=>{if(!alive)return;setSession(nextSession||null);if(nextSession)await loadProfile(nextSession.user.id);else{setProfile(null);setPrefs(DEFAULT_PREFS);}});
    return()=>{alive=false;subscription.unsubscribe();};
  },[supabase]);

  useEffect(()=>{
    if(!session||!lineCode||profile?.line_user_id)return;
    const timer=setInterval(()=>loadProfile(session.user.id),4000);
    return()=>clearInterval(timer);
  },[session,lineCode,profile?.line_user_id]);

  async function togglePreference(key){
    if(!supabase||!session||prefsBusy)return;
    const next=!prefs[key];
    setPrefsBusy(key);setError("");setMessage("");setPrefs(prev=>({...prev,[key]:next}));
    const {error:updateError}=await supabase.from("bs_member_notification_preferences").upsert({user_id:session.user.id,[key]:next,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    if(updateError){setPrefs(prev=>({...prev,[key]:!next}));setError("通知設定を保存できませんでした。");}
    else setMessage(`${NOTIFICATIONS.find(x=>x.key===key)?.title||"通知"}を${next?"ON":"OFF"}にしました。`);
    setPrefsBusy("");
  }

  async function submit(e){
    e.preventDefault();if(!supabase||busy)return;setBusy(true);setError("");setMessage("");
    try{
      if(mode==="signup"){
        if(!accepted)throw new Error("利用規約とプライバシーポリシーへの同意が必要です。");
        if(password.length<6)throw new Error("パスワードは6文字以上で設定してください。");
        const emailRedirectTo=typeof window!=="undefined"?`${window.location.origin}/members`:undefined;
        const {data,error:signError}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo,data:{display_name:displayName.trim()||null,terms_accepted:true,privacy_accepted:true}}});
        if(signError)throw signError;
        setMessage(data.session?"β会員登録が完了しました。次に公式LINEを連携してください。":"確認メールを送信しました。メール内のリンクを開くと登録完了です。");
      }else{
        const {error:loginError}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(loginError)throw loginError;setMessage("ログインしました。");
      }
    }catch(err){const raw=String(err?.message||"");if(raw.includes("User already registered"))setError("このメールアドレスは登録済みです。ログインをご利用ください。");else if(raw.includes("Invalid login credentials"))setError("メールアドレスまたはパスワードが違います。");else setError(raw||"処理に失敗しました。もう一度お試しください。");}
    finally{setBusy(false);}
  }

  async function issueLineCode(){
    if(!session||lineBusy)return;setLineBusy(true);setError("");setMessage("");
    try{const res=await fetch("/api/members/line-link-code",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`}});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body?.error||"LINE連携コードを発行できませんでした。");if(body.linked){await loadProfile(session.user.id);return;}setLineCode(body.code||"");setLineExpiresAt(body.expiresAt||"");setMessage("LINE連携コードを発行しました。公式LINEにこのコードをそのまま送信してください。");}
    catch(err){setError(String(err?.message||"")||"LINE連携コードを発行できませんでした。");}finally{setLineBusy(false);}
  }
  async function copyLineCode(){if(!lineCode)return;try{await navigator.clipboard.writeText(lineCode);setMessage("LINE連携コードをコピーしました。");}catch{setError("コピーできませんでした。コードを長押ししてコピーしてください。");}}
  async function logout(){if(!supabase)return;await supabase.auth.signOut();setMessage("ログアウトしました。");}

  if(loading)return <main className={styles.page}><div className={styles.loading}>会員情報を読み込み中...</div></main>;

  if(session){
    const plan=profile?.plan||"beta_premium";
    const emailVerified=Boolean(session.user.email_confirmed_at);
    const lineLinked=Boolean(profile?.line_user_id);
    return <main className={styles.page}>
      <section className={styles.hero}><p>BOATSTRIKERS MEMBERS</p><h1>βメンバーズ</h1><span>2026年12月31日までPREMIUM機能を無料開放中。</span></section>
      <section className={styles.memberCard}>
        <div className={styles.memberTop}><div><span className={styles.kicker}>MEMBERSHIP STATUS</span><h2>{profile?.display_name||"BoatStrikers メンバー"}</h2><p>{session.user.email}</p></div><strong className={styles.planBadge}>{PLAN_LABELS[plan]||plan}</strong></div>
        <div className={styles.statusGrid}><div><span>会員ステータス</span><strong>{profile?.membership_status==="active"?"有効":"確認中"}</strong></div><div><span>メール確認</span><strong>{emailVerified?"確認済み":"未確認"}</strong></div><div><span>LINE連携</span><strong>{lineLinked?"連携済み":"未連携"}</strong></div></div>
        {error&&<div className={styles.error}>{error}</div>}{message&&<div className={styles.success}>{message}</div>}
        <div className={styles.actions}><Link className={styles.primaryButton} href="/races">本日の出走表へ</Link><Link className={styles.secondaryButton} href="/ai-results">AI成績を見る</Link><button type="button" onClick={logout}>ログアウト</button></div>
      </section>

      <section className={`${styles.lineCard} ${lineLinked?styles.lineLinked:""}`}>
        <div className={styles.lineHead}><div><span className={styles.kicker}>OFFICIAL LINE</span><h2>{lineLinked?"✅ 公式LINE連携済み":"公式LINEを会員アカウントに連携"}</h2></div><strong>{lineLinked?"CONNECTED":"3 STEPS"}</strong></div>
        {lineLinked?<p>BoatStrikers会員IDと公式LINEの紐づけが完了しています。下の「LINE通知設定」から受け取りたい通知を選べます。</p>:<><p>サイトから登録した方は、公式LINEを友だち追加して連携コードを送信してください。</p><div className={styles.lineActions}><a href={LINE_ADD_URL} target="_blank" rel="noreferrer" className={styles.lineButton}>LINEを友だち追加・開く</a><button type="button" onClick={issueLineCode} disabled={lineBusy}>{lineBusy?"発行中...":lineCode?"新しいコードを発行":"LINE連携コードを発行"}</button></div>{lineCode&&<div className={styles.codeBox}><span>この文字を公式LINEに送信</span><strong>{lineCode}</strong><button type="button" onClick={copyLineCode}>コードをコピー</button><small>有効期限：{lineExpiresAt?new Date(lineExpiresAt).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"}):"30分"}</small></div>}</>}
      </section>

      <section className={styles.notificationCard}>
        <div className={styles.notificationHead}><div><span className={styles.kicker}>LINE NOTIFICATIONS</span><h2>LINE通知設定</h2><p>受け取りたいアラートだけONにできます。</p></div><strong>{lineLinked?"設定可能":"LINE連携が必要"}</strong></div>
        <div className={styles.notificationList}>{NOTIFICATIONS.map(item=>{const checked=Boolean(prefs[item.key]);const disabled=!lineLinked||!item.active||prefsBusy===item.key;return <div className={`${styles.notificationItem} ${!item.active?styles.notificationComing:""}`} key={item.key}><div className={styles.notificationText}><b>{item.icon}</b><span><strong>{item.title}</strong><small>{item.text}</small>{!item.active&&<em>準備中</em>}</span></div><button type="button" className={`${styles.switch} ${checked?styles.switchOn:""}`} onClick={()=>togglePreference(item.key)} disabled={disabled} aria-pressed={checked} aria-label={`${item.title} ${checked?"ON":"OFF"}`}><span /></button></div>;})}</div>
        {!lineLinked&&<p className={styles.notificationHelp}>通知を受け取るには、先に上の「公式LINE連携」を完了してください。</p>}
        <small className={styles.notificationNote}>現在配信中：キイナ・4→5展開理論／一果・隠れイン理論／一果・イン逃げ急上昇／初音・女子イン崩れ理論／初音・箱推し理論。</small>
      </section>
      <section className={styles.note}><strong>アカウント管理</strong><p><Link href="/terms">利用規約</Link> ・ <Link href="/privacy">プライバシーポリシー</Link></p></section>
    </main>;
  }

  return <main className={styles.page}>
    <section className={styles.hero}><p>BOATSTRIKERS β MEMBERSHIP</p><h1>12月まで、PREMIUM無料。</h1><span>会員登録してBoatStrikers AIの育成・検証プロジェクトに参加してください。</span></section>
    <section className={styles.authWrap}><div className={styles.tabs}><button type="button" className={mode==="signup"?styles.activeTab:""} onClick={()=>setMode("signup")}>新規会員登録</button><button type="button" className={mode==="login"?styles.activeTab:""} onClick={()=>setMode("login")}>ログイン</button></div><form onSubmit={submit} className={styles.form}><div className={styles.formHead}><span>{mode==="signup"?"BETA MEMBER":"MEMBER LOGIN"}</span><h2>{mode==="signup"?"BoatStrikers β会員になる":"会員ログイン"}</h2><p>{mode==="signup"?"登録料0円。β期間中はPREMIUM相当の機能を無料開放します。":"登録済みのメールアドレスでログインしてください。"}</p></div>{mode==="signup"&&<label>表示名（任意）<input value={displayName} onChange={e=>setDisplayName(e.target.value)} /></label>}<label>メールアドレス<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label>パスワード<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></label>{mode==="signup"&&<label><span><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} style={{width:"auto",marginRight:8}} /> <Link href="/terms" target="_blank">利用規約</Link>と<Link href="/privacy" target="_blank">プライバシーポリシー</Link>に同意します</span></label>}{error&&<div className={styles.error}>{error}</div>}{message&&<div className={styles.success}>{message}</div>}<button className={styles.submit} disabled={busy||(mode==="signup"&&!accepted)}>{busy?"処理中...":mode==="signup"?"同意して無料登録":"ログイン"}</button></form></section>
    <section className={styles.note}><strong>β期間について</strong><p>2026年12月31日まで全登録会員をβPREMIUMとして扱います。</p><Link href="/membership">会員プランを見る →</Link></section>
  </main>;
}
