"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const CONFIRM_REDIRECT = "https://boat-strike.online/members";

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export default function MemberEmailConfirmationHelper() {
  const pathname = usePathname();
  const supabase = useMemo(() => makeSupabase(), []);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session || null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      setSession(nextSession || null);
      setLoading(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (pathname !== "/members" || loading || !session?.user || session.user.email_confirmed_at) {
    return null;
  }

  async function resend() {
    if (!supabase || busy || !session.user.email) return;
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: session.user.email,
        options: { emailRedirectTo: CONFIRM_REDIRECT },
      });

      if (resendError) throw resendError;
      setMessage("確認メールを再送しました。新しく届いたメールのリンクを開いてください。");
    } catch (err) {
      const raw = String(err?.message || "");
      if (raw.toLowerCase().includes("rate") || raw.includes("60")) {
        setError("短時間に連続送信できません。1分ほど待ってから再度お試しください。");
      } else {
        setError(raw || "確認メールを再送できませんでした。");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "14px auto 0", padding: "0 16px", position: "relative", zIndex: 20 }}>
      <section style={{
        padding: "16px 18px",
        borderRadius: 16,
        border: "1px solid #ffd58a",
        background: "linear-gradient(135deg,#fffaf0,#fff3d6)",
        boxShadow: "0 8px 22px rgba(132,91,17,.08)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#9a6500", letterSpacing: ".08em" }}>EMAIL VERIFICATION</div>
        <strong style={{ display: "block", marginTop: 4, fontSize: 16, color: "#573b00" }}>メールアドレスがまだ確認されていません</strong>
        <p style={{ margin: "7px 0 12px", fontSize: 12, lineHeight: 1.7, color: "#755d2c" }}>
          確認メールのリンクが開けない場合は、下のボタンから本番サイト用の確認メールを送り直してください。
        </p>
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          style={{
            width: "100%",
            minHeight: 44,
            border: 0,
            borderRadius: 12,
            background: busy ? "#b8a57c" : "#e99a00",
            color: "#fff",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          {busy ? "再送中..." : "確認メールを再送する"}
        </button>
        {message && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "#16734b" }}>{message}</div>}
        {error && <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: "#b53a2f" }}>{error}</div>}
      </section>
    </div>
  );
}
