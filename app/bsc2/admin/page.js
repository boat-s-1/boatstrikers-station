"use client";

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./control.module.css";

const STORAGE_KEY = "bsc_ai_admin_key";
const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const JOB_TYPES = {
  history_import: { title: "過去データ", icon: "🗄️", dateRequired: false, description: "学習用の過去CSVを取り込みます。" },
  previous_day_prediction: { title: "前日版", icon: "🌅", dateRequired: true, description: "前日CSVから予測・補正・診断を生成します。" },
  after_exhibition_prediction: { title: "展示後版", icon: "🚤", dateRequired: true, description: "展示後CSVから直前診断を更新します。" },
  full_pipeline: { title: "一括処理", icon: "⚡", dateRequired: true, description: "取込から通知まで一括実行します。" },
};

const STAGES = [
  ["download", "CSV"], ["import", "Import"], ["prediction", "Prediction"],
  ["calibration", "Calibration"], ["diagnosis", "Diagnosis"],
  ["ensemble", "Ensemble"], ["dashboard", "Dashboard"], ["notification", "通知"],
];

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function statusLabel(status) {
  return { queued: "実行待ち", running: "実行中", completed: "完了", failed: "失敗", cancelled: "キャンセル" }[status] || status;
}

async function readJson(response, fallback) {
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error(`${fallback}（HTTP ${response.status}）: ${text.slice(0, 160)}`); }
  if (!response.ok) throw new Error(body.error || fallback);
  return body;
}

function Pipeline({ job }) {
  const currentIndex = Number(job.stage_index || 0);
  return (
    <div className={styles.pipeline}>
      {STAGES.map(([code, label], index) => {
        const done = job.status === "completed" || index < currentIndex;
        const active = job.status === "running" && (job.current_stage === code || index === currentIndex);
        const skipped = job.job_type === "history_import" && index > 1;
        return (
          <div className={`${styles.pipelineStep} ${done ? styles.stepDone : ""} ${active ? styles.stepActive : ""} ${skipped ? styles.stepSkipped : ""}`} key={code}>
            <span>{done ? "✓" : active ? "●" : skipped ? "–" : index + 1}</span>
            <small>{label}</small>
          </div>
        );
      })}
    </div>
  );
}

function UploadCard({ type, config, adminKey, defaultDate, onUploaded }) {
  const [file, setFile] = useState(null);
  const [raceDate, setRaceDate] = useState(defaultDate);
  const [runCalibration, setRunCalibration] = useState(true);
  const [runDiagnosis, setRunDiagnosis] = useState(true);
  const [runNotification, setRunNotification] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setRaceDate(defaultDate), [defaultDate]);

  async function upload(event) {
    event.preventDefault();
    if (!file) return setMessage("CSVファイルを選択してください。");
    if (config.dateRequired && !raceDate) return setMessage("対象日を選択してください。");
    if (!file.name.toLowerCase().endsWith(".csv")) return setMessage("CSV形式のみ対応しています。");
    if (file.size > 50 * 1024 * 1024) return setMessage("CSVは50MB以下にしてください。");

    setUploading(true);
    try {
      setMessage("アップロード準備中…");
      const signed = await readJson(await fetch("/api/bsc2/ai-control/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json", "x-bsc-ai-key": adminKey },
        body: JSON.stringify({ jobType: type, raceDate: raceDate || null, filename: file.name }),
      }), "アップロード準備に失敗しました");

      setMessage("SupabaseへCSVを送信中…");
      const { error } = await supabaseBrowser.storage.from(signed.bucket).uploadToSignedUrl(signed.storagePath, signed.token, file, { contentType: file.type || "text/csv" });
      if (error) throw error;

      setMessage("ジョブ登録中…");
      const result = await readJson(await fetch("/api/bsc2/ai-control/finalize-upload", {
        method: "POST", headers: { "Content-Type": "application/json", "x-bsc-ai-key": adminKey },
        body: JSON.stringify({ jobType: type, raceDate: raceDate || null, sourceFilename: file.name, storagePath: signed.storagePath, runCalibration, runDiagnosis, runNotification }),
      }), "ジョブ登録に失敗しました");

      setMessage(`登録完了：${result.job.id.slice(0, 8)}`);
      setFile(null);
      const input = document.getElementById(`file-${type}`); if (input) input.value = "";
      onUploaded?.();
    } catch (error) { setMessage(error?.message || "アップロードに失敗しました"); }
    finally { setUploading(false); }
  }

  return (
    <form className={styles.uploadCard} onSubmit={upload}>
      <div className={styles.uploadTitle}><span>{config.icon}</span><div><h3>{config.title}</h3><p>{config.description}</p></div></div>
      {config.dateRequired && <label className={styles.field}><span>対象日</span><input type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} /></label>}
      <label className={styles.fileDrop}><input id={`file-${type}`} type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] || null)} /><strong>{file ? file.name : "CSVを選択"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "最大50MB・Supabase直送"}</small></label>
      {type !== "history_import" && <div className={styles.optionGrid}><label><input type="checkbox" checked={runCalibration} onChange={(e) => setRunCalibration(e.target.checked)} />確率補正</label><label><input type="checkbox" checked={runDiagnosis} onChange={(e) => setRunDiagnosis(e.target.checked)} />診断生成</label><label><input type="checkbox" checked={runNotification} onChange={(e) => setRunNotification(e.target.checked)} />通知</label></div>}
      <button disabled={uploading}>{uploading ? "処理中…" : "アップロードして実行"}</button>
      {message && <p className={styles.uploadMessage}>{message}</p>}
    </form>
  );
}

export default function AiControlCenterV14() {
  const [adminKey, setAdminKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [today, setToday] = useState("");
  const [jobs, setJobs] = useState([]);
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const now = new Date();
    setToday(new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
    const stored = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY) || "";
    setAdminKey(stored); setKeyInput(stored);
  }, []);

  const loadData = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true); setError("");
    try {
      const [jobsBody, statusBody] = await Promise.all([
        readJson(await fetch("/api/bsc2/ai-control/jobs?limit=50", { headers: { "x-bsc-ai-key": adminKey }, cache: "no-store" }), "ジョブ取得に失敗しました"),
        readJson(await fetch("/api/bsc2/ai-control/status", { headers: { "x-bsc-ai-key": adminKey }, cache: "no-store" }), "状態取得に失敗しました"),
      ]);
      setJobs(jobsBody.jobs || []); setEvents(jobsBody.events || []); setSummary(jobsBody.summary || null); setSystemStatus(statusBody);
      if (!selectedJobId && jobsBody.jobs?.length) setSelectedJobId(jobsBody.jobs[0].id);
    } catch (e) { setError(e.message || "取得に失敗しました"); }
    finally { setLoading(false); }
  }, [adminKey, selectedJobId]);

  useEffect(() => { if (!adminKey) return; loadData(); const timer = setInterval(loadData, 5000); return () => clearInterval(timer); }, [adminKey, loadData]);

  async function action(jobId, name) {
    try {
      await readJson(await fetch("/api/bsc2/ai-control/actions", { method: "POST", headers: { "Content-Type": "application/json", "x-bsc-ai-key": adminKey }, body: JSON.stringify({ jobId, action: name }) }), "操作に失敗しました");
      await loadData();
    } catch (e) { setError(e.message); }
  }

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || jobs[0] || null;
  const selectedEvents = useMemo(() => events.filter((e) => e.job_id === selectedJob?.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)), [events, selectedJob]);
  const worker = systemStatus?.workers?.[0] || null;

  if (!adminKey) return <main className={styles.loginPage}><form className={styles.loginCard} onSubmit={(e) => { e.preventDefault(); const v = keyInput.trim(); if (v) { sessionStorage.setItem(STORAGE_KEY, v); setAdminKey(v); } }}><span className={styles.eyebrow}>BOAT STRIKERS AI ULTIMATE v14.1</span><h1>AI Pipeline Engine</h1><p>AI管理キーを入力してください。</p><input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} /><button>開く</button><Link href="/bsc2/admin">管理画面へ戻る</Link></form></main>;

  return (
    <main className={styles.page}>
      <header className={styles.header}><div><span className={styles.eyebrow}>BOAT STRIKERS AI ULTIMATE v14.1</span><h1>AI Pipeline Engine</h1><p>CSVから診断まで、AI運用を一元管理します。</p></div><div className={styles.headerActions}><Link href="/bsc2/admin/ai-dashboard">診断ダッシュボード</Link><Link href="/bsc2/admin">管理画面</Link><button onClick={loadData}>{loading ? "更新中…" : "更新"}</button><button onClick={() => { sessionStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STORAGE_KEY); setAdminKey(""); }}>ログアウト</button></div></header>
      {error && <div className={styles.errorBox}>{error}</div>}

      <section className={styles.healthGrid}>
        <div className={styles.healthCard}><span>Worker</span><strong className={worker?.is_online ? styles.online : styles.offline}>{worker?.is_online ? "ONLINE" : "OFFLINE"}</strong><small>{worker?.worker_name || "未接続"}</small></div>
        <div className={styles.healthCard}><span>CPU</span><strong>{worker?.cpu_percent != null ? `${Number(worker.cpu_percent).toFixed(0)}%` : "—"}</strong><small>Windows Worker</small></div>
        <div className={styles.healthCard}><span>Memory</span><strong>{worker?.memory_mb != null ? `${Number(worker.memory_mb).toFixed(0)}MB` : "—"}</strong><small>{worker?.current_job_id ? "処理中" : "待機中"}</small></div>
        <div className={styles.healthCard}><span>実行待ち</span><strong>{summary?.queued_count || 0}</strong><small>Running {summary?.running_count || 0}</small></div>
        <div className={styles.healthCard}><span>最新診断日</span><strong>{systemStatus?.latestDiagnosisDate || "—"}</strong><small>未来予測 {systemStatus?.predictionCounts?.upcoming || 0}</small></div>
      </section>

      <section className={styles.section}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>PIPELINE</span><h2>現在のAIパイプライン</h2></div><p>{selectedJob ? `${JOB_TYPES[selectedJob.job_type]?.title}・${selectedJob.source_filename}` : "ジョブなし"}</p></div>{selectedJob ? <><Pipeline job={selectedJob} /><div className={styles.currentProgress}><div><strong>{selectedJob.progress_message || "待機中"}</strong><span>{selectedJob.progress_percent || 0}%</span></div><div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${selectedJob.progress_percent || 0}%` }} /></div></div></> : <div className={styles.emptyState}>ジョブはまだありません。</div>}</section>

      <section className={styles.section}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>CSV UPLOAD</span><h2>データ登録</h2></div><p>CSVを入れるだけで自動処理</p></div><div className={styles.uploadGrid}>{Object.entries(JOB_TYPES).map(([type, config]) => <UploadCard key={type} type={type} config={config} adminKey={adminKey} defaultDate={today} onUploaded={loadData} />)}</div></section>

      <div className={styles.twoColumn}>
        <section className={styles.section}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>JOB QUEUE</span><h2>ジョブキュー</h2></div><p>{jobs.length}件</p></div><div className={styles.jobList}>{jobs.map((job) => <button key={job.id} onClick={() => setSelectedJobId(job.id)} className={`${styles.jobRow} ${selectedJob?.id === job.id ? styles.jobSelected : ""}`}><div><span className={`${styles.statusBadge} ${styles[`status_${job.status}`]}`}>{statusLabel(job.status)}</span><strong>{JOB_TYPES[job.job_type]?.title || job.job_type}</strong><small>{job.source_filename}</small></div><div><b>{job.progress_percent || 0}%</b><small>{formatDateTime(job.created_at)}</small></div></button>)}</div></section>

        <section className={styles.section}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>TIMELINE</span><h2>実行タイムライン</h2></div></div>{selectedJob ? <><div className={styles.jobActions}>{["failed", "cancelled"].includes(selectedJob.status) && <button onClick={() => action(selectedJob.id, "retry")}>▶ 再実行</button>}{["queued", "running"].includes(selectedJob.status) && <button onClick={() => action(selectedJob.id, "cancel")}>■ キャンセル</button>}{selectedJob.status !== "running" && <button className={styles.dangerButton} onClick={() => action(selectedJob.id, "delete")}>削除</button>}</div><div className={styles.timeline}>{selectedEvents.length ? selectedEvents.map((event) => <div className={`${styles.timelineItem} ${styles[`level_${event.level}`]}`} key={event.id}><span>{formatDateTime(event.created_at)}</span><div><strong>{event.message}</strong><small>{event.stage_code}</small></div></div>) : <div className={styles.emptyState}>イベントはまだありません。</div>}</div></> : <div className={styles.emptyState}>ジョブを選択してください。</div>}</section>
      </div>
    </main>
  );
}
