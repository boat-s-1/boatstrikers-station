"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const card = {
  border: "1px solid #dbe4ee",
  borderRadius: 18,
  background: "#fff",
  padding: 18,
};

function pct(value) {
  return value == null ? "—" : `${(Number(value) * 100).toFixed(1)}%`;
}

function formatTime(value) {
  if (!value) return "—";
  return String(value).slice(0, 5);
}

function rankLabel(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `${n}着` : "結果待ち";
}

export default function ExhibitionAlertsPage() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const knownIds = useRef(new Set());
  const initialized = useRef(false);

  const playAlert = useCallback(() => {
    if (!soundOn) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }, [soundOn]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/exhibition-alerts", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "取得失敗");

      const nextIds = new Set((json.alerts || []).map((x) => x.id));
      if (initialized.current) {
        const fresh = (json.alerts || []).filter((x) => !knownIds.current.has(x.id));
        if (fresh.length) playAlert();
      }
      knownIds.current = nextIds;
      initialized.current = true;
      setPayload(json);
      setError("");
    } catch (e) {
      setError(e?.message || "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [playAlert]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  async function runNow() {
    setLoading(true);
    try {
      await fetch("/api/admin/exhibition-alerts", { method: "POST" });
      await load();
    } finally {
      setLoading(false);
    }
  }

  const stats = payload?.stats || {};
  const alerts = payload?.alerts || [];

  return (
    <main style={{ minHeight: "100vh", background: "#f5f8fb", padding: "28px 16px 56px", color: "#102033" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 16, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".12em", color: "#567" }}>BOATSTRIKERS ALERT</div>
            <h1 style={{ margin: "6px 0 8px", fontSize: 30 }}>🚨 4号艇ダブル上位アラート</h1>
            <p style={{ margin: 0, color: "#617184" }}>4号艇が「展示タイム2位以内」かつ「直線タイム2位以内」で自動成立。</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setSoundOn((v) => !v)} style={{ padding: "11px 14px", borderRadius: 12, border: "1px solid #ccd7e2", background: "#fff", fontWeight: 800 }}>
              {soundOn ? "🔊 通知音 ON" : "🔇 通知音 OFF"}
            </button>
            <button onClick={runNow} disabled={loading} style={{ padding: "11px 14px", borderRadius: 12, border: 0, background: "#102033", color: "#fff", fontWeight: 800 }}>
              {loading ? "確認中…" : "今すぐ判定"}
            </button>
          </div>
        </div>

        {error ? <div style={{ ...card, borderColor: "#f0b7b7", color: "#a12" }}>{error}</div> : null}

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
          <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>本日成立</div><strong style={{ fontSize: 30 }}>{stats.matched ?? "—"}</strong></div>
          <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>1着率</div><strong style={{ fontSize: 30 }}>{pct(stats.firstRate)}</strong></div>
          <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>2連対率</div><strong style={{ fontSize: 30 }}>{pct(stats.top2Rate)}</strong></div>
          <div style={card}><div style={{ color: "#718096", fontSize: 13 }}>3連対率</div><strong style={{ fontSize: 30 }}>{pct(stats.top3Rate)}</strong></div>
        </section>

        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>成立履歴</h2>
              <div style={{ color: "#718096", fontSize: 13, marginTop: 5 }}>10秒ごとに自動更新 / DB判定は毎分実行</div>
            </div>
            <div style={{ fontSize: 13, color: "#718096" }}>{payload?.date || ""}</div>
          </div>

          {!alerts.length ? (
            <div style={{ padding: "30px 0", color: "#718096" }}>本日の成立レースはまだありません。</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {alerts.map((a) => (
                <article key={a.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gridTemplateColumns: "minmax(120px,1.3fr) repeat(3,minmax(90px,1fr))", gap: 12, alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: 18 }}>{a.course_name || `場${a.course_code}`} {a.race_no}R</strong>
                    <div style={{ marginTop: 4, color: "#718096", fontSize: 13 }}>締切 {formatTime(a.closing_time)}</div>
                  </div>
                  <div><div style={{ fontSize: 12, color: "#718096" }}>展示</div><strong>{a.exhibition_time} / {a.exhibition_rank}位</strong></div>
                  <div><div style={{ fontSize: 12, color: "#718096" }}>直線</div><strong>{a.straight_time} / {a.straight_rank}位</strong></div>
                  <div><div style={{ fontSize: 12, color: "#718096" }}>4号艇結果</div><strong>{rankLabel(a.result_rank)}</strong>{a.trifecta_payout ? <div style={{ fontSize: 12, color: "#718096" }}>3連単 {Number(a.trifecta_payout).toLocaleString()}円</div> : null}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
