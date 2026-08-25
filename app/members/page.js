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

const PLAN_LABELS={free:"FREE",beta_premium:"β PREMIUM",plus:"PLUS",premium:"PREMIUM"};

export default function MembersPage(){
  const supabase=useMemo(()=>makeSupabase(),[]);
  const [session,setSession]=useState(null);
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [mode,setMode]=useState("signup");
  const [recoveryMode,setRecoveryMode]=useState(false);
  const [displayName,setDisplayName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [accepted,setAccepted]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{
    if(!supabase){setLoading(false);setError("会員機能の設定を確認しています。しばらくしてからお試しください。");return;}
    let alive=true;
    const loadProfile=async userId=>{
      const {data}=await supabase.from("bs_member_profiles")
        .select("user_id,email,display_name,plan,membership_status,beta_member,terms_accepted_at,privacy_accepted_at,created_at")
        .eq("user_id",userId).maybeSingle();
      if(alive)setProfile(data||null);
    };
    supabase.auth.getSession().then(async({data})=>{
      if(!alive)return;
      setSession(data.session||null);
      if(data.session)await loadProfile(data.session.user.id);
      setLoading(false);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange(async(event,nextSession)=>{
      if(!alive)return;
      if(event==="PASSWORD_RECOVERY"){
        setRecoveryMode(true);setMode("login");setError("");setMessage("新しいパスワードを設定してください。");
      }
      setSession(nextSession||null);
      if(nextSession)await loadProfile(nextSession.user.id);else setProfile(null);
    });
    return()=>{alive=false;subscription.unsubscribe();};
  },[supabase]);

  async function submit(e){
    e.preventDefault();
    if(!supabase||busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      if(mode==="signup"){
        if(!accepted)throw new Error("利用規約とプライバシーポリシーへの同意が必要です。");
        if(password.length<6)throw new Error("パスワードは6文字以上で設定してください。");
        const emailRedirectTo=typeof window!=="undefined"?`${window.location.origin}/members`:undefined;
        const {data,error:signError}=await supabase.auth.signUp({
          email:email.trim(),password,
          options:{emailRedirectTo,data:{display_name:displayName.trim()||null,terms_accepted:true,privacy_accepted:true}}
        });
        if(signError)throw signError;
        setMessage(data.session?"β会員登録が完了しました。PREMIUM機能を無料で利用できます。":"確認メールを送信しました。メール内のリンクを開くと登録完了です。");
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

  async function requestPasswordReset(e){
    e.preventDefault();if(!supabase||busy)return;
    if(!email.trim()){setError("登録したメールアドレスを入力してください。");return;}
    setBusy(true);setError("");setMessage("");
    try{
      const redirectTo=typeof window!=="undefined"?`${window.location.origin}/members`:undefined;
      const {error:resetError}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo});
      if(resetError)throw resetError;
      setMessage("パスワード再設定メールを送信しました。メール内のリンクから新しいパスワードを設定してください。");
    }catch(err){setError(String(err?.message||"")||"再設定メールを送信できませんでした。");}
    finally{setBusy(false);}
  }

  async function updatePassword(e){
    e.preventDefault();if(!supabase||busy)return;
    setError("");setMessage("");
    if(password.length<6){setError("新しいパスワードは6文字以上で設定してください。");return;}
    if(password!==confirmPassword){setError("確認用パスワードが一致しません。");return;}
    setBusy(true);
    try{
      const {error:updateError}=await supabase.auth.updateUser({password});if(updateError)throw updateError;
      setPassword("");setConfirmPassword("");setRecoveryMode(false);setMessage("パスワードを変更しました。");
    }catch(err){setError(String(err?.message||"")||"パスワードを変更できませんでした。");}
    finally{setBusy(false);}
  }

  async function withdraw(){
    if(!supabase||!session||busy)return;
    const ok=window.confirm("退会すると会員アカウントと会員プロフィールが削除され、元に戻せません。退会しますか？");
    if(!ok)return;
    setBusy(true);setError("");setMessage("");
    try{
      const res=await fetch("/api/members/delete",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`}});
      const body=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(body?.error||"退会処理に失敗しました。");
      await supabase.auth.signOut();
      setSession(null);setProfile(null);setMode("login");setMessage("退会手続きが完了しました。ご利用ありがとうございました。");
    }catch(err){setError(String(err?.message||"")||"退会処理に失敗しました。");}
    finally{setBusy(false);}
  }

  async function logout(){if(!supabase)return;await supabase.auth.signOut();setMessage("ログアウトしました。");}
  function changeMode(next){setMode(next);setRecoveryMode(false);setPassword("");setConfirmPassword("");setError("");setMessage("");}

  if(loading)return <main className={styles.page}><div className={styles.loading}>会員情報を読み込み中...</div></main>;

  if(recoveryMode)return <main className={styles.page}>
    <section className={styles.hero}><p>BOATSTRIKERS MEMBERS</p><h1>パスワード再設定</h1><span>新しいパスワードを設定してください。</span></section>
    <section className={styles.authWrap}><form onSubmit={updatePassword} className={styles.form}>
      <div className={styles.formHead}><span>PASSWORD RECOVERY</span><h2>新しいパスワードを設定</h2><p>6文字以上で設定してください。</p></div>
      <label>新しいパスワード<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></label>
      <label>新しいパスワード（確認）<input type="password" required minLength={6} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} /></label>
      {error&&<div className={styles.error}>{error}</div>}{message&&<div className={styles.success}>{message}</div>}
      <button className={styles.submit} disabled={busy}>{busy?"変更中...":"パスワードを変更"}</button>
    </form></section>
  </main>;

  if(session){
    const plan=profile?.plan||"beta_premium";
    const emailVerified=Boolean(session.user.email_confirmed_at);
    return <main className={styles.page}>
      <section className={styles.hero}><p>BOATSTRIKERS MEMBERS</p><h1>βメンバーズ</h1><span>2026年12月31日までPREMIUM機能を無料開放中。</span></section>
      <section className={styles.memberCard}>
        <div className={styles.memberTop}><div><span className={styles.kicker}>MEMBERSHIP STATUS</span><h2>{profile?.display_name||"BoatStrikers メンバー"}</h2><p>{session.user.email}</p></div><strong className={styles.planBadge}>{PLAN_LABELS[plan]||plan}</strong></div>
        <div className={styles.statusGrid}>
          <div><span>会員ステータス</span><strong>{profile?.membership_status==="active"?"有効":"確認中"}</strong></div>
          <div><span>メール確認</span><strong>{emailVerified?"確認済み":"未確認"}</strong></div>
          <div><span>PREMIUM開放</span><strong>12/31まで無料</strong></div>
        </div>
        {error&&<div className={styles.error}>{error}</div>}{message&&<div className={styles.success}>{message}</div>}
        <div className={styles.actions}><Link className={styles.primaryButton} href="/races">本日の出走表へ</Link><Link className={styles.secondaryButton} href="/ai-results">AI成績を見る</Link><button type="button" onClick={logout}>ログアウト</button></div>
      </section>
      <section className={styles.note}><strong>アカウント管理</strong><p><Link href="/terms">利用規約</Link> ・ <Link href="/privacy">プライバシーポリシー</Link></p><p>退会するとログイン情報とBoatStrikers会員プロフィールが削除されます。この操作は取り消せません。</p><div className={styles.actions}><button type="button" onClick={withdraw} disabled={busy}>{busy?"処理中...":"退会する"}</button></div></section>
    </main>;
  }

  return <main className={styles.page}>
    <section className={styles.hero}><p>BOATSTRIKERS β MEMBERSHIP</p><h1>12月まで、PREMIUM無料。</h1><span>会員登録してBoatStrikers AIの育成・検証プロジェクトに参加してください。</span></section>
    <section className={styles.authWrap}>
      <div className={styles.tabs}><button type="button" className={mode==="signup"?styles.activeTab:""} onClick={()=>changeMode("signup")}>新規会員登録</button><button type="button" className={mode==="login"?styles.activeTab:""} onClick={()=>changeMode("login")}>ログイン</button></div>
      {mode==="forgot"?<form onSubmit={requestPasswordReset} className={styles.form}>
        <div className={styles.formHead}><span>PASSWORD RESET</span><h2>パスワードを忘れた方</h2><p>登録したメールアドレスへ再設定リンクを送ります。</p></div>
        <label>メールアドレス<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
        {error&&<div className={styles.error}>{error}</div>}{message&&<div className={styles.success}>{message}</div>}
        <button className={styles.submit} disabled={busy}>{busy?"送信中...":"再設定メールを送る"}</button><button type="button" className={styles.textButton} onClick={()=>changeMode("login")}>ログイン画面へ戻る</button>
      </form>:<form onSubmit={submit} className={styles.form}>
        <div className={styles.formHead}><span>{mode==="signup"?"BETA MEMBER":"MEMBER LOGIN"}</span><h2>{mode==="signup"?"BoatStrikers β会員になる":"会員ログイン"}</h2><p>{mode==="signup"?"登録料0円。β期間中はPREMIUM相当の機能を無料開放します。":"登録済みのメールアドレスでログインしてください。"}</p></div>
        {mode==="signup"&&<label>表示名（任意）<input value={displayName} onChange={e=>setDisplayName(e.target.value)} /></label>}
        <label>メールアドレス<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} /></label>
        <label>パスワード<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} /></label>
        {mode==="signup"&&<label><span><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} style={{width:"auto",marginRight:8}} /> <Link href="/terms" target="_blank">利用規約</Link>と<Link href="/privacy" target="_blank">プライバシーポリシー</Link>に同意します</span></label>}
        {mode==="login"&&<div className={styles.helperRow}><button type="button" className={styles.textButton} onClick={()=>{setMode("forgot");setPassword("");setError("");setMessage("");}}>パスワードを忘れた方</button></div>}
        {error&&<div className={styles.error}>{error}</div>}{message&&<div className={styles.success}>{message}</div>}
        <button className={styles.submit} disabled={busy||(mode==="signup"&&!accepted)}>{busy?"処理中...":mode==="signup"?"同意して無料登録":"ログイン"}</button>
        {mode==="signup"&&<small>登録時の利用規約・プライバシーポリシーへの同意日時を会員情報として記録します。</small>}
      </form>}
    </section>
    <section className={styles.note}><strong>β期間について</strong><p>2026年12月31日まで全登録会員をβPREMIUMとして扱います。2027年以降に有料プランへ移行する場合は事前にご案内し、自動で課金が始まることはありません。</p><Link href="/membership">会員プランを見る →</Link></section>
  </main>;
}
