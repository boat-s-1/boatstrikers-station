import "server-only";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import styles from "./alerts.module.css";

const FIELD_LABELS = {
  entries: "出走表",
  exhibition: "展示タイム",
  result: "結果",
  payout: "払戻",
  result_detail: "結果詳細・ST",
};

function formatJst(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

async function loadDataQualityAlerts() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { rows: null, error: true };

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client
    .from("bs_race_data_quality_alerts")
    .select("id,race_date,course_code,course_name,race_no,severity,status,missing_fields,detail,first_detected_at,last_detected_at")
    .eq("status", "active")
    .order("race_date", { ascending: false })
    .order("course_code")
    .order("race_no")
    .limit(50);

  return { rows: error ? null : data || [], error: Boolean(error) };
}

export default async function DataQualityNotificationCenter() {
  const { rows, error } = await loadDataQualityAlerts();
  const critical = rows?.filter((row) => row.severity === "critical").length || 0;

  return (
    <section id="data-quality" className={styles.notice} aria-labelledby="data-quality-title">
      <h2 id="data-quality-title">データ欠損通知</h2>
      {error ? (
        <p role="alert">欠損通知を読み込めませんでした。データが正常とは判定していません。</p>
      ) : rows.length === 0 ? (
        <p><span className={`${styles.badge} ${styles.good}`}>正常</span> 未解消の出走表・展示・結果欠損はありません。</p>
      ) : (
        <>
          <div className={styles.summary}>
            <span>未解消 <strong>{rows.length}R</strong></span>
            <span>重要 <strong>{critical}R</strong></span>
          </div>
          <div className={styles.tableWrap} style={{ marginTop: 16 }}>
            <table className={styles.table} style={{ minWidth: 720 }}>
              <caption>未解消のデータ品質アラート（最新50件）</caption>
              <thead><tr><th>開催日</th><th>場・レース</th><th>不足項目</th><th>取得状況</th><th>最終検知</th></tr></thead>
              <tbody>{rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.race_date}</td>
                  <td><Link href={`/races/${String(row.course_code).padStart(2, "0")}/${row.race_no}?date=${row.race_date}`}>{row.course_name || `場コード${row.course_code}`} {row.race_no}R</Link></td>
                  <td>{(row.missing_fields || []).map((field) => FIELD_LABELS[field] || field).join("・")}</td>
                  <td><small>出走表 {row.detail?.entry_rows ?? "—"}/6<br />展示 {row.detail?.exhibition_rows ?? "—"}/6<br />結果詳細 {row.detail?.start_rows ?? "—"}/6</small></td>
                  <td>{formatJst(row.last_detected_at)} JST</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
      <p>毎日1:10 JSTの完全性監査で更新され、データが揃ったレースは自動的に解消済みへ移ります。</p>
    </section>
  );
}
