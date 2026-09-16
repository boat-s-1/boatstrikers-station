"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import styles from "./members.module.css";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const LINE_ADD_URL = process.env.NEXT_PUBLIC_LINE_ADD_URL || "https://lin.ee/ZMbDiD5";
const PLAN_LABELS = { free: "FREE", plus: "PLUS", premium: "PREMIUM", beta_premium: "β PREMIUM" };

export default function MembersPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authSlow, setAuthSlow] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [lineBusy, setLineBusy] = useState(false);
  const [lineCode, setLineCode] = useState("");
  const [lineExpiresAt, setLineExpiresAt] = useState("");
  const appliedUserRef = useRef(null);

  async function loadProfile(userId) {
    if (!supabase || !userId) return null;
    const { data, error: profileError } = await supabase
      .from("bs_member_profiles")
      .select("user_id,display_name,plan,membership_status,line_user_id,line_linked_at,terms_accepted_at,privacy_accepted_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    setProfile(data || null);
    return data || null;
  }

  async function applySession(nextSession, { force = false } = {}) {
    const user = nextSession?.user || null;
    setSession(nextSession || null);
    if (!user) {
      appliedUserRef.current = null;
      setProfile(null);
      setAuthLoading(false);
      return;
    }
    if (!force && appliedUserRef.current === user.id) {
      setAuthLoading(false);
      return;
    }
    appliedUserRef.current = user.id;
    try {
      await loadProfile(user.id);
    } catch {
      appliedUserRef.current = null;
      setError("ログインは確認できましたが、会員プロフィールの取得に時間がかかっています。");
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    if (!supabase) {
      setError("Supabaseの公開環境変数が設定されていません。");
      setAuthLoading(false);
      return undefined;
    }
    let alive = true;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("type=recovery")) {
      setRecoveryMode(true);
      setAuthLoading(false);
    }

    const safetyTimer = window.setTimeout(() => {
      if (!alive) return;
      setAuthSlow(true);
      setAuthLoading(false);
    }, 8000);

    supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!alive) return;
        if (sessionError) throw sessionError;
        return applySession(data?.session || null);
      })
      .catch(() => {
        if (!alive) return;
        setError("ログイン状態を確認できませんでした。登録・ログインはそのままお試しいただけます。");
        setAuthLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!alive || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      void applySession(nextSession || null);
    });

    return () => {
      alive = false;
      window.clearTimeout(safetyTimer);
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true); setError(""); setMessage(""); setRegistrationComplete(false);
    try {
      if (mode === "signup") {
        if (!accepted) throw new Error("利用規約とプライバシーポリシーへの同意が必要です。");
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim(), terms_accepted: true, privacy_accepted: true } },
        });
        if (signUpError) throw signUpError;
        setRegistrationComplete(true);
        if (data?.session) {
          await applySession(data.session, { force: true });
          setMessage("無料会員登録が完了しました。TODAYから今日のレースを確認できます。");
        } else {
          setMessage("確認メールを送信しました。メール確認後にログインすると公式LINE連携も利用できます。");
        }
      } else {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (loginError) throw loginError;
        await applySession(data?.session || null, { force: true });
        setMessage("ログインしました。TODAYから今日の情報を確認できます。");
      }
    } catch (err) {
      setError(String(err?.message || "") || "認証処理に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/members` : undefined;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (resetError) throw resetError;
      setMessage("パスワード再設定メールを送信しました。");
    } catch (err) { setError(String(err?.message || "") || "再設定メールの送信に失敗しました。"); }
    finally { setBusy(false); }
  }

  async function updatePassword(event) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (password.length < 6) throw new Error("新しいパスワードは6文字以上で入力してください。");
      if (password !== confirmPassword) throw new Error("確認用パスワードが一致しません。");
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setRecoveryMode(false); setPassword(""); setConfirmPassword("");
      setMessage("パスワードを更新しました。TODAYからご利用ください。");
      if (typeof window !== "undefined" && window.location.hash) window.history.replaceState(null, "", "/members");
    } catch (err) { setError(String(err?.message || "") || "パスワード更新に失敗しました。"); }
    finally { setBusy(false); }
  }

  async function issueLineCode() {
    if (!session || lineBusy) return;
    setLineBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/members/line-link-code", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "LINE連携コードを発行できませんでした。");
      if (body.linked) {
        await loadProfile(session.user.id);
        setMessage("公式LINEはすでに連携済みです。");
      } else {
        setLineCode(body.code || ""); setLineExpiresAt(body.expiresAt || "");
      }
    } catch (err) { setError(String(err?.message || "") || "LINE連携コードを発行できませんでした。"); }
    finally { setLineBusy(false); }
  }

  async function refreshLineStatus() {
    if (!session?.user?.id || lineBusy) return;
    setLineBusy(true); setError("");
    try {
      const nextProfile = await loadProfile(session.user.id);
      if (nextProfile?.line_user_id) { setLineCode(""); setMessage("公式LINEの連携を確認しました。"); }
      else setMessage("まだLINE連携を確認できません。公式LINEへコードを送信後、もう一度確認してください。");
    } catch { setError("LINE連携状態を確認できませんでした。"); }
    finally { setLineBusy(false); }
  }

  async function copyLineCode() {
    if (!lineCode) return;
    try { await navigator.clipboard.writeText(lineCode); setMessage("LINE連携コードをコピーしました。"); }
    catch { setError("コピーできませんでした。コードを長押ししてコピーしてください。"); }
  }

  async function logout() {
    if (!supabase || busy) return;
    setBusy(true); setError("");
    try {
      const { error: logoutError } = await supabase.auth.signOut();
      if (logoutError) throw logoutError;
      appliedUserRef.current = null; setSession(null); setProfile(null); setRegistrationComplete(false); setLineCode(""); setMode("login");
      setMessage("ログアウトしました。");
    } catch (err) { setError(String(err?.message || "") || "ログアウトに失敗しました。"); }
    finally { setBusy(false); }
  }

  async function withdraw() {
    if (!supabase || !session || busy) return;
    const ok = window.confirm("退会すると会員アカウントと会員プロフィールが削除され、元に戻せません。退会しますか？");
    if (!ok) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/members/delete", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "退会処理に失敗しました。");
      await supabase.auth.signOut(); appliedUserRef.current = null; setSession(null); setProfile(null); setMode("login");
      setMessage("退会手続きが完了しました。ご利用ありがとうございました。");
    } catch (err) { setError(String(err?.message || "") || "退会処理に失敗しました。"); }
    finally { setBusy(false); }
  }

  function changeMode(next) { setMode(next); setRecoveryMode(false); setPassword(""); setConfirmPassword(""); setError(""); setMessage(""); }

  const lineLinked = Boolean(profile?.line_user_id);
  const plan = profile?.plan || "beta_premium";

  return <main className={styles.page}>
    <section className={styles.hero}><p>BOATSTRIKERS MEMBERS</p><h1>{session ? "βメンバーズ" : "無料会員"}</h1><span>{session ? "毎日の入口はTODAY。必要に応じて公式LINEや通知を設定できます。" : "登録は約1分。TODAYを毎日の入口に、気になるレースへすぐ進めます。"}</span></section>

    {!session && !registrationComplete && !recoveryMode && <section className={styles.onboardingIntro}>
      <div className={styles.introHead}><span>FREE MEMBER</span><h2>無料会員でできること</h2><p>現在提供している会員機能だけを案内しています。</p></div>
      <div className={styles.benefitGrid}>
        <article><b>01</b><strong>会員メニュー</strong><span>ログイン後、AI成績や会員向け導線をまとめて利用できます。</span></article>
        <article><b>02</b><strong>公式LINE連携</strong><span>会員IDとBoatStrikers公式LINEを連携できます。</span></article>
        <article><b>03</b><strong>通知設定</strong><span>リアルタイム通知は既存のDiscord連携ページから設定できます。</span></article>
      </div>
      <div className={styles.startFlow}><strong>登録後の使い方</strong><span>① TODAYを見る　→　② 気になるレースを見る　→　③ 必要ならLINE連携・通知設定</span></div>
    </section>}

    {authLoading && <section className={styles.authStatus} aria-live="polite"><span className={styles.spinner} aria-hidden="true" /><div><strong>ログイン状態を確認しています</strong><small>ページ全体を待たせず、認証部分だけ確認しています。</small></div></section>}
    {authSlow && !session && <section className={styles.authNotice}>ログイン状態の確認に時間がかかっています。登録・ログイン画面はそのまま利用できます。</section>}
    {error && <section className={styles.globalMessage}><div className={styles.error}>{error}</div></section>}
    {message && <section className={styles.globalMessage}><div className={styles.success}>{message}</div></section>}

    {recoveryMode ? <section className={styles.authWrap}><form onSubmit={updatePassword} className={styles.form}>
      <div className={styles.formHead}><span>PASSWORD RECOVERY</span><h2>新しいパスワードを設定</h2><p>6文字以上で設定してください。</p></div>
      <label>新しいパスワード<input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label>新しいパスワード（確認）<input type="password" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
      <button className={styles.submit} disabled={busy}>{busy ? "変更中..." : "パスワードを変更"}</button>
    </form></section>
    : session ? <>
      <section className={styles.memberCard}>
        <div className={styles.memberTop}><div><span className={styles.kicker}>WELCOME BACK</span><h2>{profile?.display_name || "BoatStrikers メンバー"}</h2><p>{session.user.email}</p></div><strong className={styles.planBadge}>{PLAN_LABELS[plan] || plan}</strong></div>
        <div className={styles.statusGrid}><div><span>会員ステータス</span><strong>{profile?.membership_status === "active" ? "有効" : "確認中"}</strong></div><div><span>メール確認</span><strong>{session.user.email_confirmed_at ? "確認済み" : "未確認"}</strong></div><div><span>公式LINE</span><strong>{lineLinked ? "連携済み" : "未連携"}</strong></div></div>
        <div className={styles.memberPrimary}><div><span>TODAY FIRST</span><strong>今日のBoatStrikersから始める</strong><small>開催場・注目レース・3人の公開候補をまとめて確認。</small></div><Link href="/today" className={styles.todayButton}>今日のTODAYを見る →</Link></div>
        <div className={styles.actions}><Link className={styles.secondaryButton} href="/races">出走表を見る</Link><Link className={styles.secondaryButton} href="/ai-results">AI成績を見る</Link><button type="button" onClick={logout} disabled={busy}>ログアウト</button></div>
      </section>

      <section className={`${styles.lineCard} ${lineLinked ? styles.lineLinked : ""}`}>
        <div className={styles.lineHead}><div><span className={styles.kicker}>OFFICIAL LINE</span><h2>{lineLinked ? "公式LINEは連携済みです" : "次に、公式LINEを連携"}</h2></div><strong>{lineLinked ? "CONNECTED" : "STEP 2"}</strong></div>
        {lineLinked ? <><p>会員IDと公式LINEの紐づけは完了しています。再連携は不要です。LINEでは無料情報・重要なお知らせを配信します。</p>{profile?.line_linked_at && <small>連携日時：{new Date(profile.line_linked_at).toLocaleString("ja-JP")}</small>}<div className={styles.lineActions}><Link href="/today" className={styles.secondaryButton}>TODAYへ戻る</Link></div></>
        : <><p>無料会員登録とは別のアカウント作成ではありません。既存のBoatStrikers会員IDと公式LINEを紐づけます。</p><div className={styles.lineSteps}><div><b>1</b><span><strong>公式LINEを開く</strong><small>友だち追加済みならそのまま次へ</small></span></div><div><b>2</b><span><strong>連携コードを発行</strong><small>有効期限は30分です</small></span></div><div><b>3</b><span><strong>LINEへコードを送信</strong><small>送信後、この画面で状態を確認</small></span></div></div><div className={styles.lineActions}><a href={LINE_ADD_URL} target="_blank" rel="noreferrer" className={styles.lineButton}>公式LINEを開く</a><button type="button" onClick={issueLineCode} disabled={lineBusy}>{lineBusy ? "確認中..." : lineCode ? "新しいコードを発行" : "LINE連携コードを発行"}</button>{lineCode && <button type="button" onClick={refreshLineStatus} disabled={lineBusy}>連携状態を更新</button>}</div>{lineCode && <div className={styles.codeBox}><span>この文字を公式LINEに送信</span><strong>{lineCode}</strong><button type="button" onClick={copyLineCode}>コードをコピー</button><small>有効期限：{lineExpiresAt ? new Date(lineExpiresAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "30分"}</small></div>}</>}
      </section>

      <section className={styles.notificationCard}><div className={styles.notificationHead}><div><span className={styles.kicker}>REAL-TIME ALERTS</span><h2>通知設定はDiscordへ</h2><p>LINEは重要なお知らせ、リアルタイム通知はDiscordと役割を分けています。</p></div><strong>STEP 3</strong></div><div className={styles.notificationList}><div className={styles.notificationItem}><div className={styles.notificationText}><b>🏁</b><span><strong>一果通知</strong><small>隠れイン・イン逃げ急上昇</small></span></div></div><div className={styles.notificationItem}><div className={styles.notificationText}><b>🌸</b><span><strong>初音通知</strong><small>女子イン崩れ・箱推し</small></span></div></div><div className={styles.notificationItem}><div className={styles.notificationText}><b>🚨</b><span><strong>キイナ通知</strong><small>カド攻め理論</small></span></div></div></div><p className={styles.notificationHelp}>必要な方だけDiscord連携ページからキャラクターごとの通知を設定できます。</p><div className={styles.actions}><Link className={styles.primaryButton} href="/members/discord">Discordを連携・通知設定</Link></div></section>

      <section className={styles.note}><strong>アカウント管理</strong><p><Link href="/terms">利用規約</Link> ・ <Link href="/privacy">プライバシーポリシー</Link></p><p>退会するとログイン情報とBoatStrikers会員プロフィールが削除されます。この操作は取り消せません。</p><div className={styles.actions}><button type="button" onClick={withdraw} disabled={busy}>{busy ? "処理中..." : "退会する"}</button></div></section>
    </>
    : registrationComplete ? <section className={styles.completeCard}><span className={styles.completeIcon}>✓</span><p className={styles.kicker}>REGISTRATION COMPLETE</p><h2>無料会員登録ありがとうございます</h2><p>まずはTODAYを見て、気になるレースを開いてみてください。</p><div className={styles.completeActions}><Link href="/today" className={styles.todayButton}>今日のBoatStrikers TODAYを見る →</Link><button type="button" onClick={() => { setMode("login"); setRegistrationComplete(false); }}>ログインして公式LINEを連携する</button></div><div className={styles.startFlow}><strong>ここからの3ステップ</strong><span>① TODAYを見る　→　② 気になるレースを見る　→　③ 必要ならLINE連携・通知設定</span></div></section>
    : !authLoading ? <section className={styles.authWrap}>
      <div className={styles.tabs}><button type="button" className={mode === "signup" ? styles.activeTab : ""} onClick={() => changeMode("signup")}>無料会員登録</button><button type="button" className={mode === "login" ? styles.activeTab : ""} onClick={() => changeMode("login")}>ログイン</button></div>
      {mode === "forgot" ? <form onSubmit={requestPasswordReset} className={styles.form}><div className={styles.formHead}><span>PASSWORD RESET</span><h2>パスワードを忘れた方</h2><p>登録したメールアドレスへ再設定リンクを送ります。</p></div><label>メールアドレス<input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><button className={styles.submit} disabled={busy}>{busy ? "送信中..." : "再設定メールを送る"}</button><button type="button" className={styles.textButton} onClick={() => changeMode("login")}>ログイン画面へ戻る</button></form>
      : <form onSubmit={submit} className={styles.form}><div className={styles.formHead}><span>{mode === "signup" ? "START FREE" : "MEMBER LOGIN"}</span><h2>{mode === "signup" ? "無料会員になる" : "会員ログイン"}</h2><p>{mode === "signup" ? "メールアドレスとパスワードで約1分。" : "登録済みのメールアドレスでログインしてください。"}</p></div>{mode === "signup" && <label>表示名（任意）<input value={displayName} onChange={e => setDisplayName(e.target.value)} /></label>}<label>メールアドレス<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label><label>パスワード<input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} /></label>{mode === "signup" && <label><span><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} style={{ width: "auto", marginRight: 8 }} /> <Link href="/terms" target="_blank">利用規約</Link>と<Link href="/privacy" target="_blank">プライバシーポリシー</Link>に同意します</span></label>}{mode === "login" && <div className={styles.helperRow}><button type="button" className={styles.textButton} onClick={() => { setMode("forgot"); setPassword(""); setError(""); setMessage(""); }}>パスワードを忘れた方</button></div>}<button className={styles.submit} disabled={busy || (mode === "signup" && !accepted)}>{busy ? "処理中..." : mode === "signup" ? "同意して無料登録" : "ログイン"}</button><small>{mode === "signup" ? "登録後に自動課金されることはありません。" : ""}</small></form>}
    </section> : null}

    <section className={styles.note}><strong>β期間について</strong><p>2026年12月31日まで全登録会員をβPREMIUMとして扱います。2027年以降に有料プランへ移行する場合は事前にご案内し、自動で課金が始まることはありません。</p><Link href="/membership">会員プランを見る →</Link></section>
  </main>;
}
