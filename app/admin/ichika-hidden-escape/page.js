"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

function shiftDate(date, days) {
  const d = new Date(`${date}T00:00:00+09:00`);
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function IchikaHiddenEscapePage() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [soundOn, setSoundOn] = useState(false);
  const [date, setDate] = useState(todayJst());
  const [mode, setMode] = useState("day");
  const knownIds = useRef(new Set());
  const initialized = useRef(false);

  const playAlert = useCallback(() => {
    if (!soundOn) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 740;
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
      const qs = new URLSearchParams({ date, mode });
      const res = await fetch(`/api/admin/ichika-hidden-escape?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "取得失敗");

      if (mode === "day" && date === todayJst()) {
        const nextIds = new Set((json.alerts || []).map((x) => x.id));
        if (initialized.current) {
          const fresh = (json.alerts || []).filter((x) => !knownIds.current.has(x.id));
          if (fresh.length) playAlert();
        }
        knownIds.current = nextIds;
        initialized.current = true;
      }

      setPayload(json);
      setError("");
    } catch (e) {
      setError(e?.message || "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [date, mode, playAlert]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load]);

  async function runNow() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ichika-hidden-escape", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || "判定に失敗しました");
      await load();
    } catch (e) {
      setError(e?.message || "判定に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  const stats = payload?.stats || {};
  const allStats = payload?.allStats || {};
  const alerts = payload?.alerts || [];
  const daily = payload?.daily || [];

  const summaryText = useMemo(() => {
    const s = mode === "all" ? allStats : stats;
    return `成立${s.matched ?? 0}R / 1着${s.first ?? 0}R / 2連対${s.top2 ?? 0}R / 3連対${s.top3 ?? 0}R`;
  }, [mode, stats, allStats]);

  return (
    <main style={{ minHeight: "100vh", background: "#fffaf0", padding: "28px 16px 56px", color: "#102033" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 16, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".12em", color: "#9a6b00" }}>BOATSTRIKERS / ICHIKA ALERT</div>
            <h1 style={{ margin: "6px 0 8px", fontSize: 30 }}>🏁 一果・隠れイン理論</h1>
            <p style={{ margin: 0, color: "#617184" }}>B1×展示色なし×1周1位の隠れイン条件。履歴・実績を自動集計します。</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setSoundOn((v) => !v)} style={{ padding: "11px 14px", borderRadius: 12, border: "1px solid #e6d7ae", background: "#fff", fontWeight: 800 }}>
              {soundOn ? "🔊 通知音 ON" : "🔇 通知音 OFF"}
            </button>
            <button onClick={runNow} disabled={loading} style={{ padding: "11px 14px", borderRadius: 12, border: 0, background: "#d49a00", color: "#fff", fontWeight: 800 }}>
              {loading ? "確認中…" : "今すぐ判定"}
            </button>
          </div>
        </div>

        <section style={{ ...card, marginBottom: 20, borderColor: "#f0d990", background: "#fffdf7" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>現在の強シグナル条件</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["① B1級", "展示3〜4位（色なし）", "展示トップ差0.03秒以内", "1周タイム1位"].map((x) => (
              <span key={x} style={{ padding: "7px 10px", borderRadius: 999, background: "#fff3c4", color: "#7b5800", fontSize: 13, fontWeight: 800 }}>{x}</span>
            ))}
          </div>
        </section>

        {error ? <div style={{ ...card, borderColor: "#f0b7b7", color: "#a12", marginBottom: 16 }}>{error}</div> : null}

        <section style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => setMode("day")} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e2cf9c", background: mode === "day" ? "#d49a00" : "#fff", color: mode === "day" ? "#fff" : "#102033", fontWeight: 800 }}>日付別</button>
            <button onClick={() => setMode("all")} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e2cf9c", background: mode === "all" ? "#d49a00" : "#fff", color: mode === "all" ? "#fff" : "#102033", fontWeight: 800 }}>全期間</button>
            {mode === "day" && (
              <>
                <button onClick={() => setDate((d) => shiftDate(d, -1))} style={navButton}>← 前日</button>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid #e2cf9c", fontWeight: 700 }} />
                <button onClick={() => setDate((d) => shiftDate(d, 1))} style={navButton}>翌日 →</button>
                <button onClick={() => setDate(todayJst())} style={navButton}>今日</button>
              </>
            )}
            <span style={{ marginLeft: "auto", color: "#718096", fontSize: 13 }}>{summaryText}</span>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
          <div style={card}><div style={label}>{mode === "all" ? "全期間成立" : "成立"}</div><strong style={{ fontSize: 30 }}>{stats.matched ?? "—"}</strong></div>
          <div style={card}><div style={label}>1着率</div><strong style={{ fontSize: 30, color: "#c48300" }}>{pct(stats.firstRate)}</strong></div>
          <div style={card}><div style={label}>2連対率</div><strong style={{ fontSize: 30 }}>{pct(stats.top2Rate)}</strong></div>
          <div style={card}><div style={label}>3連対率</div><strong style={{ fontSize: 30 }}>{pct(stats.top3Rate)}</strong></div>
          <div style={card}><div style={label}>3連単払戻合計</div><strong style={{ fontSize: 24 }}>{Number(stats.payoutTotal || 0).toLocaleString()}円</strong></div>
        </section>

        {mode === "day" && (
          <section style={{ ...card, marginBottom: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>成立履歴</h2>
              <div style={{ color: "#718096", fontSize: 13, marginTop: 5 }}>{date} / 10秒ごとに自動更新</div>
            </div>
            {!alerts.length ? <div style={{ padding: "30px 0", color: "#718096" }}>この日の成立レースはありません。</div> : <AlertList alerts={alerts} />}
          </section>
        )}

        <section style={{ ...card, marginBottom: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>📅 日別実績</h2>
            <div style={{ color: "#718096", fontSize: 13, marginTop: 5 }}>日ごとの成立数・1号艇着順・払戻を一覧表示</div>
          </div>
          {!daily.length ? <div style={{ padding: "20px 0", color: "#718096" }}>履歴がありません。</div> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead><tr>{["日付","成立","1着","2連対","3連対","1着率","3連対率","払戻合計"].map((h) => <th key={h} style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid #dbe4ee", fontSize: 12, color: "#718096" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {daily.map((d) => (
                    <tr key={d.date} onClick={() => { setDate(d.date); setMode("day"); }} style={{ cursor: "pointer" }}>
                      <td style={td}><strong>{d.date}</strong></td><td style={td}>{d.matched}R</td><td style={td}>{d.first}R</td><td style={td}>{d.top2}R</td><td style={td}>{d.top3}R</td><td style={td}>{pct(d.firstRate)}</td><td style={td}>{pct(d.top3Rate)}</td><td style={td}>{Number(d.payoutTotal || 0).toLocaleString()}円</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {mode === "all" && (
          <section style={card}>
            <div style={{ marginBottom: 14 }}><h2 style={{ margin: 0, fontSize: 20 }}>全期間の成立レース</h2><div style={{ color: "#718096", fontSize: 13, marginTop: 5 }}>最新5000件まで表示</div></div>
            {!alerts.length ? <div style={{ padding: "30px 0", color: "#718096" }}>履歴がありません。</div> : <AlertList alerts={alerts} showDate />}
          </section>
        )}
      </div>
    </main>
  );
}

const navButton = { padding: "10px 12px", borderRadius: 10, border: "1px solid #e2cf9c", background: "#fff" };
const label = { color: "#718096", fontSize: 13 };
const td = { padding: "11px 8px", borderBottom: "1px solid #eef2f6", fontSize: 14 };

function AlertList({ alerts, showDate = false }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {alerts.map((a) => (
        <article key={a.id} style={{ border: "1px solid #f0dfb4", borderRadius: 14, padding: 14, display: "grid", gridTemplateColumns: "minmax(150px,1.35fr) repeat(4,minmax(95px,1fr))", gap: 12, alignItems: "center", background: "#fffdf8" }}>
          <div>
            <strong style={{ fontSize: 18 }}>{a.course_name || `場${a.course_code}`} {a.race_no}R</strong>
            <div style={{ marginTop: 4, color: "#718096", fontSize: 13 }}>{showDate ? `${a.race_date} / ` : ""}締切 {formatTime(a.closing_time)}</div>
            <div style={{ marginTop: 5, fontSize: 12, fontWeight: 800, color: "#9a6b00" }}>① {a.racer_class || "B1"}</div>
          </div>
          <div><div style={label}>展示</div><strong>{a.exhibition_time ?? "—"} / {a.exhibition_rank ?? "—"}位</strong></div>
          <div><div style={label}>トップ差</div><strong>{a.exhibition_gap == null ? "—" : `${Number(a.exhibition_gap).toFixed(2)}秒`}</strong></div>
          <div><div style={label}>1周</div><strong>{a.lap_time ?? "—"} / {a.lap_rank ?? "—"}位</strong></div>
          <div><div style={label}>1号艇結果</div><strong>{rankLabel(a.result_rank)}</strong>{a.trifecta_payout ? <div style={{ fontSize: 12, color: "#718096" }}>3連単 {Number(a.trifecta_payout).toLocaleString()}円</div> : null}</div>
        </article>
      ))}
    </div>
  );
}
