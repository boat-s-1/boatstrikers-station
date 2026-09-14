"use client";

import { useMemo, useState } from "react";

function formatJst(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const STAGE_LABELS = {
  discord_only: "Discord参加のみ",
  linked: "サイト会員連携済み",
  premium: "PREMIUM権限あり",
};

export default function DiscordAudiencePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  async function load() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/discord-members", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || "Discord参加状況を取得できませんでした。");
      setData(body);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  const members = useMemo(() => {
    const rows = Array.isArray(data?.members) ? data.members : [];
    if (filter === "all") return rows;
    return rows.filter((row) => row.stage === filter);
  }, [data, filter]);

  return (
    <section style={{ margin: "18px 0", background: "#fff", border: "1px solid #dcecf7", borderRadius: 22, padding: 18, boxShadow: "0 12px 30px rgba(27,80,125,.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#5865F2", fontSize: 11, fontWeight: 900, letterSpacing: ".12em" }}>DISCORD AUDIENCE</div>
          <h2 style={{ margin: "5px 0 4px", fontSize: 22, color: "#173e66" }}>Discord参加状況</h2>
          <p style={{ margin: 0, color: "#718598", fontSize: 13, fontWeight: 700 }}>Discord参加者とBoatStrikers会員を突き合わせ、登録転換を確認します。</p>
        </div>
        <button onClick={load} disabled={loading} style={{ border: 0, borderRadius: 12, padding: "11px 16px", background: "#5865F2", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
          {loading ? "取得中..." : data ? "Discord参加状況を更新" : "Discord参加状況を取得"}
        </button>
      </div>

      {error && <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "#fff0f0", color: "#b23f3f", fontSize: 13, fontWeight: 800 }}>{error}</div>}

      {!data && !error && <div style={{ marginTop: 14, padding: 14, borderRadius: 14, background: "#f5f8ff", color: "#65798e", fontSize: 13, lineHeight: 1.7 }}>ボタンを押した時だけDiscordから最新参加者を取得します。会員管理ページを開くだけではDiscord APIを呼びません。</div>}

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginTop: 16 }}>
            <article style={cardStyle}><span style={labelStyle}>Discord参加者</span><strong style={numberStyle}>{data.stats.total}</strong></article>
            <article style={cardStyle}><span style={labelStyle}>Discord参加のみ</span><strong style={numberStyle}>{data.stats.discordOnly}</strong></article>
            <article style={cardStyle}><span style={labelStyle}>サイト会員連携済み</span><strong style={numberStyle}>{data.stats.siteLinked}</strong></article>
            <article style={cardStyle}><span style={labelStyle}>PREMIUM権限あり</span><strong style={numberStyle}>{data.stats.premium}</strong></article>
            <article style={{ ...cardStyle, background: "#f1f4ff", borderColor: "#cfd6ff" }}><span style={labelStyle}>Discord→サイト登録率</span><strong style={{ ...numberStyle, color: "#5865F2" }}>{data.stats.conversionRate}%</strong></article>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {["all", "discord_only", "linked", "premium"].map((key) => (
                <button key={key} onClick={() => setFilter(key)} style={{ border: "1px solid #d5e2ed", borderRadius: 999, padding: "7px 11px", background: filter === key ? "#173e66" : "#fff", color: filter === key ? "#fff" : "#557086", fontSize: 11, fontWeight: 900, cursor: "pointer" }}>
                  {key === "all" ? "すべて" : STAGE_LABELS[key]}
                </button>
              ))}
            </div>
            <div style={{ color: "#8292a0", fontSize: 11, fontWeight: 800 }}>更新 {formatJst(data.fetchedAt)} / {members.length}件表示</div>
          </div>

          <div style={{ overflowX: "auto", marginTop: 10, border: "1px solid #e2edf5", borderRadius: 14 }}>
            <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ background: "#f5f9fc", color: "#6e8395", textAlign: "left" }}><th style={th}>Discord</th><th style={th}>区分</th><th style={th}>サイト会員</th><th style={th}>Discord参加日</th><th style={th}>連携日</th><th style={th}>PREMIUMロール</th></tr></thead>
              <tbody>
                {members.map((row) => (
                  <tr key={row.discordUserId} style={{ borderTop: "1px solid #edf3f7" }}>
                    <td style={td}><strong>{row.globalName || row.nick || row.username || "Discord"}</strong><div style={subStyle}>@{row.username || "—"}</div></td>
                    <td style={td}><span style={{ display: "inline-flex", padding: "5px 8px", borderRadius: 999, background: row.stage === "premium" ? "#e8f8ef" : row.stage === "linked" ? "#e7f3ff" : "#fff3d9", color: row.stage === "premium" ? "#17864b" : row.stage === "linked" ? "#1c71b6" : "#9b6800", fontWeight: 900 }}>{STAGE_LABELS[row.stage]}</span></td>
                    <td style={td}>{row.linked ? <><strong>{row.displayName || row.email || "会員連携済み"}</strong><div style={subStyle}>{row.plan || "—"}</div></> : <span style={{ color: "#8a98a4" }}>未登録 / 未連携</span>}</td>
                    <td style={td}>{formatJst(row.joinedAt)}</td>
                    <td style={td}>{formatJst(row.linkedAt)}</td>
                    <td style={td}>{row.premiumRoleAssigned ? <span style={{ color: "#17864b", fontWeight: 900 }}>付与済み</span> : <span style={{ color: "#8a98a4" }}>なし</span>}</td>
                  </tr>
                ))}
                {members.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#7b8d9b", padding: 28 }}>該当するDiscord参加者はいません。</td></tr>}
              </tbody>
            </table>
          </div>
          <p style={{ margin: "10px 0 0", color: "#8192a1", fontSize: 11, lineHeight: 1.7 }}>※ Botアカウントは除外しています。「サイト会員連携済み」はDiscordとBoatStrikers会員IDが紐付いている人、「PREMIUM権限あり」は現在の会員権限がPREMIUM相当の人です。</p>
        </>
      )}
    </section>
  );
}

const cardStyle = { border: "1px solid #dcecf7", borderRadius: 16, padding: 14, background: "#fbfdff" };
const labelStyle = { display: "block", color: "#718598", fontSize: 11, fontWeight: 800 };
const numberStyle = { display: "block", marginTop: 4, color: "#173e66", fontSize: 27 };
const th = { padding: "10px 12px", fontSize: 10, letterSpacing: ".04em" };
const td = { padding: "11px 12px", verticalAlign: "top", color: "#3f5b70" };
const subStyle = { marginTop: 3, color: "#8999a6", fontSize: 10 };
