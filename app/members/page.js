"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import styles from "./members.module.css";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const OFFICIAL_LINE_URL = process.env.NEXT_PUBLIC_LINE_OFFICIAL_URL || "https://lin.ee/ZMbDiD5";

function normalizeMember(row, user) {
  return {
    id: row?.id || user?.id || null,
    email: row?.email || user?.email || "",
    nickname: row?.nickname || "",
    member_level: row?.member_level || "free",
    membership_status: row?.membership_status || "active",
    line_user_id: row?.line_user_id || null,
    beta_premium_until: row?.beta_premium_until || "2026-12-31",
  };
}

function planLabel(level) {
  if (level === "premium") return "PREMIUM";
  if (level === "plus") return "PLUS";
  return "FREE";
}

export default function MembersPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authSlow, setAuthSlow] = useState(false);
  const [mode, setMode] = useState("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [member, setMember] = useState(null);
  const [session, setSession] = useState(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [updatePasswordMode, setUpdatePasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [linkExpiresAt, setLinkExpiresAt] = useState("");
  const appliedUserRef = useRef(null);

  async function applySession(nextSession, { force = false } = {}) {
    const user = nextSession?.user || null;
    setSession(nextSession || null);
    if (!user) {
      appliedUserRef.current = null;
      setMember(null);
      setAuthLoading(false);
      return;
    }

    if (!force && appliedUserRef.current === user.id) {
      setAuthLoading(false);
      return;
    }
    appliedUserRef.current = user.id;

    try {
      const { data, error: memberError } = await supabase
        .from("members")
        .select("id,email,nickname,member_level,membership_status,line_user_id,beta_premium_until")
        .eq("id", user.id)
        .maybeSingle();
      if (memberError) throw memberError;
      setMember(normalizeMember(data, user));
    } catch (err) {
      appliedUserRef.current = null;
      setMember(normalizeMember(null, user));
      setError("会員情報の取得に時間がかかっています。ログイン状態は確認できています。");
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
      setUpdatePasswordMode(true);
      setMessage("新しいパスワードを設定してください。");
      setAuthLoading(false);
    }

    const slowTimer = window.setTimeout(() => {
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
      window.clearTimeout(slowTimer);
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function handleRegister(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setRegistrationComplete(false);
    try {
      if (!supabase) throw new Error("Supabaseが初期化されていません。");
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { nickname: nickname.trim() } },
      });
      if (signUpError) throw signUpError;
      if (data?.session) {
        await applySession(data.session, { force: true });
        setRegistrationComplete(true);
        setMessage("無料会員登録が完了しました。今日のTODAYから始めましょう。");
      } else {
        setRegistrationComplete(true);
        setMessage("登録メールを送信しました。メール確認後にログインするとLINE連携も利用できます。");
      }
    } catch (err) {
      setError(err?.message || "登録に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!supabase) throw new Error("Supabaseが初期化されていません。");
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (loginError) throw loginError;
      await applySession(data?.session || null, { force: true });
      setMessage("ログインしました。TODAYから今日のレースを確認できます。");
    } catch (err) {
      setError(err?.message || "ログインに失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setError("");
    try {
      const { error: logoutError } = await supabase.auth.signOut();
      if (logoutError) throw logoutError;
      appliedUserRef.current = null;
      setSession(null);
      setMember(null);
      setRegistrationComplete(false);
      setLinkCode("");
      setMessage("ログアウトしました。");
    } catch (err) {
      setError(err?.message || "ログアウトに失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("パスワード再設定メールを送るメールアドレスを入力してください。");
      return;
    }
    setBusy(true);
    try {
      const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/members` : undefined;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (resetError) throw resetError;
      setMessage("パスワード再設定メールを送信しました。メール内のリンクから新しいパスワードを設定してください。");
    } catch (err) {
      setError(err?.message || "再設定メールの送信に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdatePassword(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (newPassword.length < 6) throw new Error("新しいパスワードは6文字以上で入力してください。");
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setUpdatePasswordMode(false);
      setNewPassword("");
      setMessage("パスワードを更新しました。TODAYからご利用ください。");
      if (typeof window !== "undefined" && window.location.hash) window.history.replaceState(null, "", "/members");
    } catch (err) {
      setError(err?.message || "パスワード更新に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function createLineLinkCode() {
    setLinkBusy(true);
    setLinkError("");
    setLinkCode("");
    try {
      if (!supabase || !session?.user?.id) throw new Error("先に会員ログインしてください。");
      const { data, error: rpcError } = await supabase.rpc("create_link_code");
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.code) throw new Error("連携コードを発行できませんでした。");
      setLinkCode(String(row.code));
      setLinkExpiresAt(row.expires_at || "");
    } catch (err) {
      setLinkError(err?.message || "連携コードの発行に失敗しました。");
    } finally {
      setLinkBusy(false);
    }
  }

  async function copyLinkCode() {
    if (!linkCode || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(linkCode);
      setMessage("LINE連携コードをコピーしました。");
    } catch {
      setLinkError("コピーできませんでした。コードを長押ししてコピーしてください。");
    }
  }

  const lineLinked = Boolean(member?.line_user_id);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p>BOATSTRIKERS MEMBERS</p>
        <h1>無料会員</h1>
        <span>登録はメールアドレスとパスワードで約1分。登録後はTODAYを毎日の入口に、必要に応じて公式LINEと連携できます。</span>
      </section>

      {!session && !registrationComplete && (
        <section className={styles.onboardingIntro}>
          <div className={styles.introHead}>
            <span>FREE MEMBER</span>
            <h2>無料会員でできること</h2>
            <p>現在提供中の会員機能だけをまとめています。</p>
          </div>
          <div className={styles.benefitGrid}>
            <article><b>01</b><strong>会員メニュー</strong><span>ログイン後の会員メニューからAI予想・AIラボ・成績ページへ移動できます。</span></article>
            <article><b>02</b><strong>公式LINE連携</strong><span>会員IDと公式LINEを連携するためのコードを発行できます。</span></article>
            <article><b>03</b><strong>通知設定</strong><span>LINE連携後、提供中の通知設定を会員ページから変更できます。</span></article>
          </div>
          <div className={styles.startFlow}><strong>使い方はシンプル</strong><span>① TODAYを見る　→　② 気になるレースを見る　→　③ 必要ならLINE通知を設定</span></div>
        </section>
      )}

      {authLoading && (
        <section className={styles.authStatus} aria-live="polite">
          <span className={styles.spinner} aria-hidden="true" />
          <div><strong>ログイン状態を確認しています</strong><small>ページの案内はそのままご覧いただけます。</small></div>
        </section>
      )}

      {authSlow && !session && (
        <section className={styles.authNotice}>ログイン状態の確認に時間がかかっています。下の登録・ログイン操作はそのまま利用できます。</section>
      )}

      {error && <section className={styles.globalMessage}><div className={styles.error}>{error}</div></section>}
      {message && <section className={styles.globalMessage}><div className={styles.success}>{message}</div></section>}

      {updatePasswordMode ? (
        <section className={styles.authWrap}>
          <form className={styles.form} onSubmit={handleUpdatePassword}>
            <div className={styles.formHead}><span>PASSWORD UPDATE</span><h2>新しいパスワードを設定</h2><p>6文字以上で入力してください。</p></div>
            <label>新しいパスワード<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required /></label>
            <button className={styles.submit} disabled={busy}>{busy ? "更新中..." : "パスワードを更新"}</button>
          </form>
        </section>
      ) : session && member ? (
        <>
          <section className={styles.memberCard}>
            <div className={styles.memberTop}>
              <div><span className={styles.kicker}>WELCOME BACK</span><h2>{member.nickname || "BoatStrikers会員"}</h2><p>{member.email}</p></div>
              <strong className={styles.planBadge}>{planLabel(member.member_level)}</strong>
            </div>
            <div className={styles.statusGrid}>
              <div><span>会員ステータス</span><strong>{member.membership_status === "active" ? "有効" : member.membership_status}</strong></div>
              <div><span>公式LINE</span><strong>{lineLinked ? "連携済み" : "未連携"}</strong></div>
              <div><span>βPREMIUM期限</span><strong>{member.beta_premium_until || "2026-12-31"}</strong></div>
            </div>
            <div className={styles.memberPrimary}>
              <div><span>TODAY FIRST</span><strong>今日のBoatStrikersから始める</strong><small>開催場・注目レース・3人の公開候補をまとめて確認できます。</small></div>
              <Link href="/today" className={styles.todayButton}>今日のTODAYを見る →</Link>
            </div>
            <div className={styles.actions}>
              <Link href="/races" className={styles.secondaryButton}>出走表を見る</Link>
              <Link href="/ai" className={styles.secondaryButton}>AI予想を見る</Link>
              <Link href="/ai-lab" className={styles.secondaryButton}>AIラボを見る</Link>
              <Link href="/ai-results" className={styles.secondaryButton}>AI成績を見る</Link>
              <button onClick={handleLogout} disabled={busy}>ログアウト</button>
            </div>
          </section>

          {!lineLinked ? (
            <section className={styles.lineCard}>
              <div className={styles.lineHead}><div><span className={styles.kicker}>STEP 2</span><h2>公式LINEを連携する</h2></div><strong>未連携</strong></div>
              <p>無料会員登録の次は、必要な方だけ公式LINEと会員IDを連携してください。LINE連携後に通知設定を利用できます。</p>
              <div className={styles.lineSteps}>
                <div><b>1</b><span><strong>連携コードを発行</strong><small>会員ページでコードを作成</small></span></div>
                <div><b>2</b><span><strong>公式LINEを開く</strong><small>BoatStrikers公式LINEへ移動</small></span></div>
                <div><b>3</b><span><strong>コードを送信</strong><small>案内に沿って連携を完了</small></span></div>
              </div>
              <div className={styles.lineActions}>
                <button onClick={createLineLinkCode} disabled={linkBusy}>{linkBusy ? "発行中..." : "LINE連携コードを発行"}</button>
                <a className={styles.lineButton} href={OFFICIAL_LINE_URL} target="_blank" rel="noreferrer">公式LINEを開く</a>
              </div>
              {linkError && <div className={styles.error}>{linkError}</div>}
              {linkCode && <div className={styles.codeBox}><span>あなたのLINE連携コード</span><strong>{linkCode}</strong><button onClick={copyLinkCode}>コードをコピー</button><small>{linkExpiresAt ? `有効期限: ${new Date(linkExpiresAt).toLocaleString("ja-JP")}` : "発行後は早めに公式LINEへ送信してください。"}</small></div>}
            </section>
          ) : (
            <section className={`${styles.lineCard} ${styles.lineLinked}`}>
              <div className={styles.lineHead}><div><span className={styles.kicker}>LINE CONNECTED</span><h2>公式LINEは連携済みです</h2></div><strong>連携済み</strong></div>
              <p>再連携は不要です。必要な通知だけ設定して、毎日はTODAYから確認してください。</p>
              <div className={styles.lineActions}><Link href="/members/notifications" className={styles.lineButton}>通知設定を見る</Link><Link href="/today" className={styles.secondaryButton}>TODAYへ戻る</Link></div>
            </section>
          )}
        </>
      ) : registrationComplete ? (
        <section className={styles.completeCard}>
          <span className={styles.completeIcon}>✓</span>
          <p className={styles.kicker}>REGISTRATION COMPLETE</p>
          <h2>無料会員登録ありがとうございます</h2>
          <p>まずは今日のBoatStrikers TODAYを見て、気になるレースを開いてみてください。</p>
          <div className={styles.completeActions}><Link href="/today" className={styles.todayButton}>今日のBoatStrikers TODAYを見る →</Link><button type="button" onClick={() => { setMode("login"); setRegistrationComplete(false); }}>ログインして公式LINEを連携する</button></div>
          <div className={styles.startFlow}><strong>ここからの3ステップ</strong><span>① TODAYを見る　→　② 気になるレースを見る　→　③ 必要ならLINE通知を設定</span></div>
        </section>
      ) : !authLoading ? (
        <section className={styles.authWrap}>
          <div className={styles.tabs}><button className={mode === "register" ? styles.activeTab : ""} onClick={() => { setMode("register"); setError(""); setMessage(""); }}>無料会員登録</button><button className={mode === "login" ? styles.activeTab : ""} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>ログイン</button></div>
          {mode === "register" ? (
            <form className={styles.form} onSubmit={handleRegister}>
              <div className={styles.formHead}><span>START FREE</span><h2>無料会員になる</h2><p>メールアドレス・パスワード・表示名だけで登録できます。</p></div>
              <label>メールアドレス<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
              <label>パスワード<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={6} required /></label>
              <label>表示名<input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} required /></label>
              <button className={styles.submit} disabled={busy}>{busy ? "登録中..." : "無料で登録する"}</button>
              <small>登録後に自動課金されることはありません。</small>
            </form>
          ) : (
            <form className={styles.form} onSubmit={handleLogin}>
              <div className={styles.formHead}><span>WELCOME BACK</span><h2>ログイン</h2><p>登録済みのメールアドレスとパスワードを入力してください。</p></div>
              <label>メールアドレス<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
              <label>パスワード<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
              <div className={styles.helperRow}><button type="button" className={styles.textButton} onClick={handleResetPassword} disabled={busy}>パスワードを忘れた方</button></div>
              <button className={styles.submit} disabled={busy}>{busy ? "ログイン中..." : "ログイン"}</button>
            </form>
          )}
        </section>
      ) : null}

      <section className={styles.note}><strong>β期間について</strong><p>2026年12月31日まで全登録会員をβPREMIUMとして扱います。2027年以降に有料プランへ移行する場合は事前にご案内し、自動で課金が始まることはありません。</p><Link href="/membership">会員プランを見る →</Link></section>
    </main>
  );
}
