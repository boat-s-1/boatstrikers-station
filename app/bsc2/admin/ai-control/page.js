"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./control.module.css";
import { createClient } from "@supabase/supabase-js";

const STORAGE_KEY = "bsc_ai_admin_key";




const JOB_TYPES = {const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
  history_import: {
    title: "過去データ",
    description: "学習用の過去レースCSVを取り込みます。",
    icon: "🗄️",
    accept: ".csv,text/csv",
    dateRequired: false,
  },
  previous_day_prediction: {
    title: "前日版",
    description: "出走表CSVから3AIの前日予測を生成します。",
    icon: "🌅",
    accept: ".csv,text/csv",
    dateRequired: true,
  },
  after_exhibition_prediction: {
    title: "展示後版",
    description: "展示データCSVから直前予測と診断を更新します。",
    icon: "🚤",
    accept: ".csv,text/csv",
    dateRequired: true,
  },
  full_pipeline: {
    title: "一括処理",
    description: "CSV取込から予測・補正・診断まで実行します。",
    icon: "⚡",
    accept: ".csv,text/csv",
    dateRequired: true,
  },
};

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function statusLabel(status) {
  const map = {
    queued: "実行待ち",
    running: "実行中",
    completed: "完了",
    failed: "失敗",
    cancelled: "キャンセル",
  };

  return map[status] || status;
}

function statusClass(styles, status) {
  return styles[`status_${status}`] || styles.status_queued;
}

function UploadCard({
  type,
  config,
  adminKey,
  defaultDate,
  onUploaded,
}) {
  const [file, setFile] = useState(null);
  const [raceDate, setRaceDate] = useState(defaultDate);
  const [runCalibration, setRunCalibration] = useState(true);
  const [runDiagnosis, setRunDiagnosis] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setRaceDate(defaultDate);
  }, [defaultDate]);

  async function upload(event) {
  event.preventDefault();

  if (!file) {
    setMessage("CSVファイルを選択してください。");
    return;
  }

  if (config.dateRequired && !raceDate) {
    setMessage("対象日を選択してください。");
    return;
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    setMessage("CSV形式のみアップロードできます。");
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    setMessage("CSVは50MB以下にしてください。");
    return;
  }

  setUploading(true);
  setMessage("アップロード準備中…");

  try {
    // 1. Vercelから署名付きアップロード情報を取得
    const urlResponse = await fetch(
      "/api/bsc2/ai-control/upload-url",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bsc-ai-key": adminKey,
        },
        body: JSON.stringify({
          jobType: type,
          raceDate: raceDate || null,
          filename: file.name,
        }),
      },
    );

    const urlText = await urlResponse.text();

    let urlBody;

    try {
      urlBody = JSON.parse(urlText);
    } catch {
      throw new Error(
        `アップロード準備APIの応答が不正です。HTTP ${urlResponse.status}`,
      );
    }

    if (!urlResponse.ok) {
      throw new Error(
        urlBody.error ||
          "アップロード準備に失敗しました",
      );
    }

    setMessage("SupabaseへCSVを送信中…");

    // 2. CSV本体はVercelを通さずSupabaseへ直接送信
    const { error: uploadError } =
      await supabaseBrowser.storage
        .from(urlBody.bucket)
        .uploadToSignedUrl(
          urlBody.storagePath,
          urlBody.token,
          file,
          {
            contentType:
              file.type || "text/csv",
          },
        );

    if (uploadError) {
      throw uploadError;
    }

    setMessage("処理ジョブを登録中…");

    // 3. アップロード完了後、ジョブだけを登録
    const finalizeResponse = await fetch(
      "/api/bsc2/ai-control/finalize-upload",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bsc-ai-key": adminKey,
        },
        body: JSON.stringify({
          jobType: type,
          raceDate: raceDate || null,
          sourceFilename: file.name,
          storagePath: urlBody.storagePath,
          runCalibration,
          runDiagnosis,
        }),
      },
    );

    const finalizeText =
      await finalizeResponse.text();

    let finalizeBody;

    try {
      finalizeBody = JSON.parse(finalizeText);
    } catch {
      throw new Error(
        `ジョブ登録APIの応答が不正です。HTTP ${finalizeResponse.status}`,
      );
    }

    if (!finalizeResponse.ok) {
      throw new Error(
        finalizeBody.error ||
          "ジョブ登録に失敗しました",
      );
    }

    setMessage(
      `登録完了：ジョブ ${finalizeBody.job.id.slice(
        0,
        8,
      )}`,
    );

    setFile(null);

    const input = document.getElementById(
      `file-${type}`,
    );

    if (input) {
      input.value = "";
    }

    onUploaded?.();
  } catch (error) {
    setMessage(
      error?.message ||
        "アップロードに失敗しました",
    );
  } finally {
    setUploading(false);
  }
}

  return (
    <form className={styles.uploadCard} onSubmit={upload}>
      <div className={styles.uploadTitle}>
        <span>{config.icon}</span>
        <div>
          <h3>{config.title}</h3>
          <p>{config.description}</p>
        </div>
      </div>

      {config.dateRequired && (
        <label className={styles.field}>
          <span>対象日</span>
          <input
            type="date"
            value={raceDate}
            onChange={(event) => setRaceDate(event.target.value)}
          />
        </label>
      )}

      <label className={styles.fileDrop}>
        <input
          id={`file-${type}`}
          type="file"
          accept={config.accept}
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        <strong>{file ? file.name : "CSVを選択"}</strong>
        <small>
          {file
            ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
            : "クリックしてファイルを選択してください"}
        </small>
      </label>

      {type !== "history_import" && (
        <div className={styles.optionGrid}>
          <label>
            <input
              type="checkbox"
              checked={runCalibration}
              onChange={(event) => setRunCalibration(event.target.checked)}
            />
            確率補正
          </label>

          <label>
            <input
              type="checkbox"
              checked={runDiagnosis}
              onChange={(event) => setRunDiagnosis(event.target.checked)}
            />
            診断生成
          </label>
        </div>
      )}

      <button type="submit" disabled={uploading}>
        {uploading ? "アップロード中…" : "アップロードして実行待ちへ"}
      </button>

      {message && <p className={styles.uploadMessage}>{message}</p>}
    </form>
  );
}

export default function AiControlCenterPage() {
  const [adminKey, setAdminKey] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [today, setToday] = useState("");
  const [jobs, setJobs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const now = new Date();
    const localDate = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000,
    )
      .toISOString()
      .slice(0, 10);

    setToday(localDate);

    const stored =
      window.sessionStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem(STORAGE_KEY) ||
      "";

    setAdminKey(stored);
    setKeyInput(stored);
  }, []);

  const loadData = useCallback(async () => {
    if (!adminKey) return;

    setLoading(true);
    setError("");

    try {
      const [jobsResponse, statusResponse] = await Promise.all([
        fetch("/api/bsc2/ai-control/jobs?limit=50", {
          headers: {
            "x-bsc-ai-key": adminKey,
          },
          cache: "no-store",
        }),
        fetch("/api/bsc2/ai-control/status", {
          headers: {
            "x-bsc-ai-key": adminKey,
          },
          cache: "no-store",
        }),
      ]);

      const jobsBody = await jobsResponse.json();
      const statusBody = await statusResponse.json();

      if (!jobsResponse.ok) {
        throw new Error(jobsBody.error || "ジョブ取得に失敗しました");
      }

      if (!statusResponse.ok) {
        throw new Error(statusBody.error || "状態取得に失敗しました");
      }

      setJobs(jobsBody.jobs || []);
      setSummary(jobsBody.summary || null);
      setSystemStatus(statusBody);
    } catch (requestError) {
      setError(requestError.message || "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (!adminKey) return undefined;

    loadData();

    const timer = window.setInterval(loadData, 5000);

    return () => window.clearInterval(timer);
  }, [adminKey, loadData]);

  function saveKey(event) {
    event.preventDefault();

    const value = keyInput.trim();

    if (!value) return;

    window.sessionStorage.setItem(STORAGE_KEY, value);
    setAdminKey(value);
  }

  function logout() {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_KEY);
    setAdminKey("");
    setKeyInput("");
    setJobs([]);
    setSummary(null);
    setSystemStatus(null);
  }

  const activeJobs = useMemo(
    () => jobs.filter((job) => ["queued", "running"].includes(job.status)),
    [jobs],
  );

  if (!adminKey) {
    return (
      <main className={styles.loginPage}>
        <form className={styles.loginCard} onSubmit={saveKey}>
          <span className={styles.eyebrow}>BOAT STRIKERS AI ULTIMATE</span>
          <h1>AIコントロールセンター</h1>
          <p>BSC_AI_ADMIN_KEYを入力してください。</p>

          <input
            type="password"
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            placeholder="AI管理キー"
          />

          <button type="submit">コントロールセンターを開く</button>

          <Link href="/bsc2/admin">管理画面へ戻る</Link>
        </form>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>BOAT STRIKERS AI ULTIMATE v12</span>
          <h1>AIコントロールセンター</h1>
          <p>CSV登録からAI診断までを一元管理します。</p>
        </div>

        <div className={styles.headerActions}>
          <Link href="/bsc2/admin/ai-dashboard">診断ダッシュボード</Link>
          <Link href="/bsc2/admin">管理画面へ戻る</Link>
          <button type="button" onClick={loadData} disabled={loading}>
            {loading ? "更新中…" : "更新"}
          </button>
          <button type="button" onClick={logout}>
            ログアウト
          </button>
        </div>
      </header>

      {error && <div className={styles.errorBox}>{error}</div>}

      <section className={styles.statusGrid}>
        <div className={styles.statusCard}>
          <span>実行待ち</span>
          <strong>{summary?.queued_count || 0}</strong>
        </div>
        <div className={styles.statusCard}>
          <span>実行中</span>
          <strong>{summary?.running_count || 0}</strong>
        </div>
        <div className={styles.statusCard}>
          <span>完了</span>
          <strong>{summary?.completed_count || 0}</strong>
        </div>
        <div className={styles.statusCard}>
          <span>失敗</span>
          <strong>{summary?.failed_count || 0}</strong>
        </div>
      </section>

      <section className={styles.workerBanner}>
        <div>
          <span>Windows AI Worker</span>
          <strong>
            {activeJobs.some((job) => job.status === "running")
              ? "処理中"
              : "待機中"}
          </strong>
        </div>

        <div>
          <span>最終完了</span>
          <strong>{formatDateTime(summary?.last_completed_at)}</strong>
        </div>

        <div>
          <span>履歴予測</span>
          <strong>{systemStatus?.predictionCounts?.history || 0}</strong>
        </div>

        <div>
          <span>未来予測</span>
          <strong>{systemStatus?.predictionCounts?.upcoming || 0}</strong>
        </div>

        <div>
          <span>最新診断日</span>
          <strong>{systemStatus?.latestDiagnosisDate || "—"}</strong>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>CSV UPLOAD</span>
            <h2>データ登録</h2>
          </div>
          <p>最大50MB・CSV形式</p>
        </div>

        <div className={styles.uploadGrid}>
          {Object.entries(JOB_TYPES).map(([type, config]) => (
            <UploadCard
              key={type}
              type={type}
              config={config}
              adminKey={adminKey}
              defaultDate={today}
              onUploaded={loadData}
            />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>PROCESS QUEUE</span>
            <h2>処理状況</h2>
          </div>
          <p>5秒ごとに自動更新</p>
        </div>

        {jobs.length === 0 ? (
          <div className={styles.emptyState}>処理ジョブはまだありません。</div>
        ) : (
          <div className={styles.jobList}>
            {jobs.map((job) => (
              <article className={styles.jobCard} key={job.id}>
                <div className={styles.jobTop}>
                  <div>
                    <span
                      className={`${styles.statusBadge} ${statusClass(
                        styles,
                        job.status,
                      )}`}
                    >
                      {statusLabel(job.status)}
                    </span>
                    <h3>{JOB_TYPES[job.job_type]?.title || job.job_type}</h3>
                    <p>{job.source_filename}</p>
                  </div>

                  <div className={styles.jobMeta}>
                    <span>{job.race_date || "日付指定なし"}</span>
                    <small>{formatDateTime(job.created_at)}</small>
                  </div>
                </div>

                <div className={styles.progressHeader}>
                  <span>{job.progress_message || "実行待ちです"}</span>
                  <strong>{job.progress_percent || 0}%</strong>
                </div>

                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${job.progress_percent || 0}%` }}
                  />
                </div>

                {job.worker_name && (
                  <p className={styles.workerName}>Worker: {job.worker_name}</p>
                )}

                {job.error_message && (
                  <pre className={styles.jobError}>{job.error_message}</pre>
                )}

                {job.status === "completed" &&
                  job.result_summary &&
                  Object.keys(job.result_summary).length > 0 && (
                    <pre className={styles.resultSummary}>
                      {JSON.stringify(job.result_summary, null, 2)}
                    </pre>
                  )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
