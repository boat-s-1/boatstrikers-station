"use client";

import { useState } from "react";

export default function BackfillButton({ date }) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");

  async function run() {
    if (running) return;
    setRunning(true);
    setStatus("再取得を開始しています…");
    let cursor = 0;
    let savedRaces = 0;
    let savedRows = 0;
    let unavailable = 0;
    try {
      while (cursor !== null) {
        const res = await fetch("/api/admin/exhibition-backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, cursor, batchSize: 18 }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "再取得に失敗しました");
        savedRaces += Number(json.savedRaces || 0);
        savedRows += Number(json.savedRows || 0);
        unavailable += Number(json.unavailable || 0);
        cursor = json.nextCursor;
        const done = Math.min(Number(json.totalRaces || 0), Number(json.cursor || 0) + Number(json.processed || 0));
        setStatus(`${done}/${json.totalRaces}R確認中… 取得${savedRaces}R`);
      }
      setStatus(`完了：${savedRaces}R / ${savedRows}艇を追加取得。未公開・取得不可 ${unavailable}R`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      setStatus(`エラー：${error?.message || "再取得に失敗しました"}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={run}
        disabled={running}
        style={{
          border: 0,
          borderRadius: 12,
          padding: "11px 15px",
          background: running ? "#94a3b8" : "#102033",
          color: "#fff",
          fontWeight: 900,
          cursor: running ? "wait" : "pointer",
        }}
      >
        {running ? "再取得中…" : "今日の未取得データを再取得"}
      </button>
      {status ? <span style={{ fontSize: 13, color: status.startsWith("エラー") ? "#b91c1c" : "#526174", fontWeight: 700 }}>{status}</span> : null}
    </div>
  );
}
