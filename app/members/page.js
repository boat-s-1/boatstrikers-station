"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import styles from "./members.module.css";

function makeSupabase(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key)return null;
  return createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}

const PLAN_LABELS={
  free:"FREE",
  beta_premium:"β PREMIUM",
  plus:"PLUS",
  premium:"PREMIUM",
};

export default function MembersPage(){
  const supabase=useMemo(()=>makeSupabase(),[]);
  const [session,setSession]=useState(null);
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [mode,setMode]=useState("signup");
  const [displayName,setDisplayName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{
    if(!supabase){setLoading(false);setError("会員機能の設定を確認しています。しばらくしてからお試しください。");return;}
    let alive=true;
    async function init(){
      const {data}=await supabase.auth.getSession();
      if(!alive)return;
      setSession(data.session||null);
      if(data.session)await loadProfile(data.session.user.id);
      setLoading(false);
    }
    init();
    const {data:{subscription}}=supabase.auth.onAuthStateChange(async(_event,nextSession)=>{
      if(!alive)return;
      setSession(nextSession||null);
      if(nextSession)await loadProfile(nextSession.user.id); else setProfile(null);
    });
    return()=>{alive=false;subscription.unsubscribe();};
  },[supabase]);

  async function loadProfile(userId){
    if(!supabase)return;
    const {data,error:profileError}=await supabase
      .from("bs_member_profiles")
      .select("user_id,email,display_name,plan,membership_status,beta_member,beta_started_at,premium_until,line_user_id,created_at")
      .eq("user_id",userId)
      .maybeSingle();
    if(profileError){setError("会員情報を読み込めませんでした。");return;}
    setProfile(data||null);
  }

  async function submit(e){
    e.preventDefault();
    if(!supabase||busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      if(mode==="signup"){
        if(password.length<6)throw new Error("パスワードは6文字以上で設定してください。");
        const {data,error:signError}=await supabase.auth.signUp({
          email:email.trim(),
          password,
          options:{data:{display_name:displayName.trim()||null}},
        });
        if(signError)throw signError;
        if(data.session){
          setMessage("β会員登録が完了しました。PREMIUM機能を無料で利用できます。");
        }else{
          setMessage("確認メールを送信しました。メール内のリンクを開くと登録完了です。");
        }
      }else{
        const {error:loginError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(loginError)throw loginError;
        setMessage("ログインしました。");
      }
    }catch(err){
      const raw=String(err?.message||"");
      if(raw.includes("User already registered"))setError("このメールアドレスは登録済みです。ログインをご利用ください。");
      else if(raw.includes("Invalid login credentials"))setError("メールアドレスまたはパスワードが違います。");
      else setError(raw||"処理に失敗しました。もう一度お試しください。");
    }finally{setBusy(false);}
  }

  async function logout(){
    if(!supabase)return;
    await supabase.auth.signOut();
    setMessage("ログアウトしました。");
  }

  if(loading)return <main className={styles.page}><div className={styles.loading}>会員情報を読み込み中...</div></main>;

  if(session){
    const plan=profile?.plan||"beta_premium";
    return <main className={styles.page}>
      <section className={styles.hero}>
        <p>BOATSTRIKERS MEMBERS</p>
        <h1>βメンバーズ</h1>
        <span>AI育成・サービス改善期間につき、2026年12月31日までPREMIUM機能を無料開放中。</span>
      </section>

      <section className={styles.memberCard}>
        <div className={styles.memberTop}>
          <div><span className={styles.kicker}>MEMBERSHIP STATUS</span><h2>{profile?.display_name||"BoatStrikers メンバー"}</h2><p>{session.user.email}</p></div>
          <strong className={styles.planBadge}>{PLAN_LABELS[plan]||plan}</strong>
        </div>
        <div className={styles.statusGrid}>
          <div><span>会員ステータス</span><strong>{profile?.membership_status==="active"?"有効":"確認中"}</strong></div>
          <div><span>β会員</span><strong>{profile?.beta_member!==false?"参加中":"—"}</strong></div>
          <div><span>PREMIUM開放</span><strong>12/31まで無料</strong></div>
        </div>
        <div className={styles.actions}>
          <Link className={styles.primaryButton} href="/races">本日の出走表へ</Link>
          <Link className={styles.secondaryButton} href="/ai-results">AI成績を見る</Link>
          <button type="button" onClick={logout}>ログアウト</button>
        </div>
      </section>

      <section className={styles.betaInfo}>
        <div><span>🌙</span><strong>前日版AI</strong><p>β期間中は会員向けPREMIUM機能として順次開放します。</p></div>
        <div><span>⚡</span><strong>直前版AI</strong><p>展示後のAI分析・買い目機能も会員基盤に接続していきます。</p></div>
        <div><span>💬</span><strong>LINE連携</strong><p>次の段階で会員IDと公式LINEを紐付け、会員限定配信に対応します。</p></div>
      </section>
    </main>;
  }

  return <main className={styles.page}>
    <section className={styles.hero}>
      <p>BOATSTRIKERS β MEMBERSHIP</p>
      <h1>12月まで、PREMIUM無料。</h1>
      <span>会員登録してBoatStrikers AIの育成・検証プロジェクトに参加してください。</span>
    </section>

    <section className={styles.authWrap}>
      <div className={styles.tabs}>
        <button type="button" className={mode==="signup"?styles.activeTab:""} onClick={()=>{setMode("signup");setError("");setMessage("");}}>新規会員登録</button>
        <button type="button" className={mode==="login"?styles.activeTab:""} onClick={()=>{setMode("login");setError("");setMessage("");}}>ログイン</button>
      </div>

      <form onSubmit={submit} className={styles.form}>
        <div className={styles.formHead}>
          <span>{mode==="signup"?"BETA MEMBER":"MEMBER LOGIN"}</span>
          <h2>{mode==="signup"?"BoatStrikers β会員になる":"会員ログイン"}</h2>
          <p>{mode==="signup"?"登録料0円。β期間中はPREMIUM相当の機能を無料開放します。":"登録済みのメールアドレスでログインしてください。"}</p>
        </div>
        {mode==="signup"&&<label>表示名（任意）<input value={displayName} onChange={e=>setDisplayName(e.target.value)} autoComplete="nickname" placeholder="ニックネーム" /></label>}
        <label>メールアドレス<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="mail@example.com" /></label>
        <label>パスワード<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="signup"?"new-password":"current-password"} placeholder="6文字以上" /></label>
        {error&&<div className={styles.error}>{error}</div>}
        {message&&<div className={styles.success}>{message}</div>}
        <button className={styles.submit} disabled={busy}>{busy?"処理中...":mode==="signup"?"無料でβ会員登録":"ログイン"}</button>
        <small>登録により、BoatStrikersのサービス提供に必要な範囲で会員情報を利用することに同意したものとします。</small>
      </form>
    </section>

    <section className={styles.note}>
      <strong>β期間について</strong>
      <p>2026年12月31日まで全登録会員をβPREMIUMとして扱います。2027年以降に有料プランへ移行する場合は、事前に内容と料金をご案内します。自動で課金が始まることはありません。</p>
      <Link href="/membership">会員プランを見る →</Link>
    </section>
  </main>;
}
