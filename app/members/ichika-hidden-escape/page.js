"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

export default function IchikaHiddenEscapeNotificationPage() {
  const supabase = useMemo(() => makeSupabase(), []);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setError("会員機能の設定を確認できませんでした。");
      setLoading(false);
      return;
    }

    let alive = true;
    async function load() {
      const { data: authData } = await supabase.auth.getSession();
      if (!alive) return;
      const nextSession = authData.session || null;
      setSession(nextSession);
      if (!nextSession) {
        setLoading(false);
        return;
      }

      const userId = nextSession.user.id;
      const [profileResult, prefResult] = await Promise.all([
        supabase
          .from("bs_member_profiles")
          .select("user_id,line_user_id,line_linked_at,membership_status")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("bs_member_notification_preferences")
          .select("ichika_escape")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      if (!alive) return;
      setProfile(profileResult.data || null);
      if (prefResult.error) {
        setError("通知設定を読み込めませんでした。");
      } else if (prefResult.data) {
        setEnabled(Boolean(prefResult.data.ichika_escape));
      } else {
        const { data: created, error: createError } = await supabase
          .from("bs_member_notification_preferences")
          .insert({ user_id: userId, ichika_escape: false })
          .select("ichika_escape")
          .single();
        if (createError) setError("通知設定を作成できませんでした。");
        else setEnabled(Boolean(created?.ichika_escape));
      }
      setLoading(false);
    }

    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      setSession(nextSession || null);
      if (!nextSession) {
        setProfile(null);
        setEnabled(false);
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function toggle() {
    if (!supabase || !session || busy) return;
    if (!profile?.line_user_id && !profile?.line_linked_at) {
      setError("LINE連携後に通知をONにできます。");
      return;
    }

    const next = !enabled;
    setBusy(true);
    setError("");
    setMessage("");

    const { error: updateError } = await supabase
      .from("bs_member_notification_preferences")
      .upsert(
        { user_id: session.user.id, ichika_escape: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (updateError) {
      setError("通知設定を保存できませんでした。");
    } else {
      setEnabled(next);
      setMessage(`隠れイン理論のLINE通知を${next ? "ON" : "OFF"}にしました。`);
    }
    setBusy(false);
  }

  const lineLinked = Boolean(profile?.line_user_id || profile?.line_linked_at);

  return (
    <main style={{ minHeight: "100vh", background: "#fff7fb", padding: "28px 16px 64px", color: "#17345c" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/members" style={{ display: "inline-block", marginBottom: 16, color: "#526079", fontWeight: 800, textDecoration: "none" }}>
          ← 会員ページへ戻る
        </Link>

        <section style={{ border: "2px solid #ff7eaa", borderRadius: 24, overflow: "hidden", background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,.08)" }}>
          <div style={{ padding: "22px 20px", background: "linear-gradient(135deg,#ffd9e8,#fff1f7 48%,#eef8ff)" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#cf3e78", letterSpacing: ".08em" }}>ICHIKA LINE ALERT</div>
            <h1 style={{ margin: "5px 0 5px", fontSize: 28, lineHeight: 1.2 }}>🏁 隠れイン理論</h1>
            <p style={{ margin: 0, color: "#6c4960", fontWeight: 800 }}>
              一果の隠れイン条件が成立したレースをLINEでお知らせします。
            </p>
          </div>

          <div style={{ padding: 20 }}>
            <div style={{ padding: 16, borderRadius: 18, background: "#fff5f9", border: "1px solid #ffd5e5", marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#cf3e78" }}>通知する条件</div>
              <strong style={{ display: "block", marginTop: 4, fontSize: 22, color: "#17345c" }}>B1 × 展示色なし × 一周1位</strong>
              <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.6, color: "#718096" }}>
                展示タイムだけでは目立たない1号艇の狙い目を、一果の隠れイン条件として通知します。
              </p>
            </div>

            {loading ? <div style={{ padding: 20, textAlign: "center", color: "#718096" }}>設定を読み込み中…</div> : null}

            {!loading && !session ? (
              <div style={{ padding: 16, borderRadius: 16, background: "#f7f9fc", border: "1px solid #dbe4ee" }}>
                <strong>会員ログインが必要です。</strong>
                <div style={{ marginTop: 10 }}>
                  <Link href="/members" style={{ color: "#1266b3", fontWeight: 900 }}>ログイン・会員ページへ →</Link>
                </div>
              </div>
            ) : null}

            {!loading && session ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "17px 16px", borderRadius: 18, border: "1px solid #e5eaf0", background: "#fff" }}>
                  <div>
                    <strong style={{ fontSize: 18 }}>LINE通知</strong>
                    <div style={{ marginTop: 4, fontSize: 13, color: lineLinked ? "#16833d" : "#b36a00", fontWeight: 800 }}>
                      {lineLinked ? "LINE連携済み・設定可能" : "LINE連携が必要です"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggle}
                    disabled={busy || !lineLinked}
                    aria-pressed={enabled}
                    style={{ width: 88, padding: "12px 8px", border: 0, borderRadius: 999, background: enabled ? "#06c755" : "#d8dee7", color: "#fff", fontWeight: 900, fontSize: 15, cursor: busy || !lineLinked ? "not-allowed" : "pointer" }}
                  >
                    {busy ? "保存中" : enabled ? "ON" : "OFF"}
                  </button>
                </div>
                {!lineLinked ? <p style={{ margin: "10px 2px 0", fontSize: 13, color: "#718096" }}>会員ページで公式LINEを連携するとONにできます。</p> : null}
              </>
            ) : null}

            {error ? <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#fff1f1", color: "#b42318", fontWeight: 800 }}>{error}</div> : null}
            {message ? <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#edfff3", color: "#117a38", fontWeight: 800 }}>{message}</div> : null}

            <div style={{ marginTop: 20, padding: 14, borderRadius: 14, background: "#f7f9fc", color: "#526079", fontSize: 12, lineHeight: 1.7 }}>
              ※過去データや展示情報をもとにしたアラートです。的中や利益を保証するものではありません。
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
