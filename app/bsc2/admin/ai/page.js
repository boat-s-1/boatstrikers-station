"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./ai-admin.css";

const JOB_LABELS = {
  import_training_csv: "学習CSV取込",
  generate_features: "特徴量更新",
  train_ichika_v3: "一果AI再学習",
  predict_history_v3: "過去予測更新",
  run_training_all: "学習処理を全部実行",
  import_previous_day: "前日CSV取込",
  predict_previous_day: "前日版予測",
  run_previous_day: "前日版を作成",
  import_after_exhibition: "展示後CSV取込",
  predict_after_exhibition: "直前版予測",
  run_after_exhibition: "直前版を作成",
};

const STATUS_LABELS = {
  pending: "実行待ち",
  running: "実行中",
  completed: "完了",
  failed: "失敗",
  cancelled: "取消",
};

const STADIUM_NAMES = {
  1: "桐生",
  2: "戸田",
  3: "江戸川",
  4: "平和島",
  5: "多摩川",
  6: "浜名湖",
  7: "蒲郡",
  8: "常滑",
  9: "津",
  10: "三国",
  11: "びわこ",
  12: "住之江",
  13: "尼崎",
  14: "鳴門",
  15: "丸亀",
  16: "児島",
  17: "宮島",
  18: "徳山",
  19: "下関",
  20: "若松",
  21: "芦屋",
  22: "福岡",
  23: "唐津",
  24: "大村",
};

function percent(value, digits = 1) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `${(number * 100).toFixed(digits)}%`;
}

function metric(value, digits = 4) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toFixed(digits);
}

function formatDateTime(value) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStatusClass(status) {
  return `aiStatus aiStatus-${status || "unknown"}`;
}

export default function BoatStrikersAiAdminPage() {
  const [accessKey, setAccessKey] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [runningJob, setRunningJob] = useState("");
  const [uploadingType, setUploadingType] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [trainingFile, setTrainingFile] = useState(null);
  const [previousFile, setPreviousFile] = useState(null);
  const [afterFile, setAfterFile] = useState(null);

  useEffect(() => {
    const savedKey = sessionStorage.getItem("bsc-ai-admin-key");

    if (savedKey) {
      setAccessKey(savedKey);
      setAuthorized(true);
    }
  }, []);

  const apiFetch = useCallback(
    async (url, options = {}) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          "x-bsc-ai-key": accessKey,
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "通信に失敗しました");
      }

      return data;
    },
    [accessKey]
  );

  const loadDashboard = useCallback(async () => {
    if (!authorized || !accessKey) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const data = await apiFetch("/api/bsc2/ai/dashboard");
      setDashboard(data);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [accessKey, apiFetch, authorized]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!authorized) return;

    const timer = setInterval(() => {
      loadDashboard();
    }, 8000);

    return () => clearInterval(timer);
  }, [authorized, loadDashboard]);

  const login = async () => {
    if (!accessKey.trim()) {
      setErrorMessage("AI管理キーを入力してください");
      return;
    }

    sessionStorage.setItem(
      "bsc-ai-admin-key",
      accessKey.trim()
    );

    setAuthorized(true);
    setErrorMessage("");
  };

  const logout = () => {
    sessionStorage.removeItem("bsc-ai-admin-key");
    setAuthorized(false);
    setDashboard(null);
    setAccessKey("");
  };

  const createJob = async (jobType) => {
    setRunningJob(jobType);
    setErrorMessage("");

    try {
      await apiFetch("/api/bsc2/ai/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job_type: jobType,
        }),
      });

      await loadDashboard();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setRunningJob("");
    }
  };

  const uploadCsv = async (fileType, file) => {
    if (!file) {
      setErrorMessage("CSVファイルを選択してください");
      return;
    }

    setUploadingType(fileType);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_type", fileType);

      await apiFetch("/api/bsc2/ai/upload", {
        method: "POST",
        body: formData,
      });

      if (fileType === "training_csv") {
        setTrainingFile(null);
      }

      if (fileType === "previous_day_csv") {
        setPreviousFile(null);
      }

      if (fileType === "after_exhibition_csv") {
        setAfterFile(null);
      }

      await loadDashboard();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setUploadingType("");
    }
  };

  const models = dashboard?.models || [];
  const jobs = dashboard?.jobs || [];
  const predictions = dashboard?.predictions || [];
  const status = dashboard?.system_status;

  const previousModel = useMemo(
    () =>
      models.find(
        (item) => item.data_timing === "previous_day"
      ),
    [models]
  );

  const afterModel = useMemo(
    () =>
      models.find(
        (item) =>
          item.data_timing === "after_exhibition"
      ),
    [models]
  );

  const groupedPredictions = useMemo(() => {
    const map = new Map();

    for (const prediction of predictions) {
      const race = prediction.upcoming_races;

      if (!race) continue;

      const key =
        `${race.race_date}-` +
        `${race.stadium_code}-` +
        `${race.race_no}`;

      const current = map.get(key) || {
        race_date: race.race_date,
        stadium_code: race.stadium_code,
        race_no: race.race_no,
        previous: null,
        after: null,
      };

      if (prediction.data_timing === "previous_day") {
        current.previous = prediction;
      }

      if (
        prediction.data_timing === "after_exhibition"
      ) {
        current.after = prediction;
      }

      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) => {
      const dateCompare = String(b.race_date).localeCompare(
        String(a.race_date)
      );

      if (dateCompare !== 0) return dateCompare;

      if (a.stadium_code !== b.stadium_code) {
        return a.stadium_code - b.stadium_code;
      }

      return a.race_no - b.race_no;
    });
  }, [predictions]);

  if (!authorized) {
    return (
      <main className="aiAdminPage">
        <section className="aiLoginCard">
          <div className="aiLogo">🤖</div>
          <p className="aiEyebrow">BOAT STRIKERS AI</p>
          <h1>AI管理画面</h1>
          <p>
            Vercelに登録した
            <code>BSC_AI_ADMIN_KEY</code>
            を入力してください。
          </p>

          <input
            type="password"
            value={accessKey}
            placeholder="AI管理キー"
            onChange={(event) =>
              setAccessKey(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                login();
              }
            }}
          />

          {errorMessage && (
            <p className="aiError">{errorMessage}</p>
          )}

          <button type="button" onClick={login}>
            AI管理画面を開く
          </button>

          <Link href="/bsc2/admin">
            ← 通常の管理画面へ戻る
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="aiAdminPage">
      <header className="aiAdminHeader">
        <Link href="/bsc2/admin" className="aiBack">
          ←
        </Link>

        <div>
          <p>BOAT STRIKERS AI</p>
          <h1>AI CONTROL CENTER</h1>
        </div>

        <button
          type="button"
          className="aiLogout"
          onClick={logout}
        >
          ログアウト
        </button>
      </header>

      {errorMessage && (
        <div className="aiErrorBanner">
          {errorMessage}
        </div>
      )}

      <section className="aiHero">
        <div>
          <span
            className={
              status?.worker_online
                ? "aiOnline"
                : "aiOffline"
            }
          >
            {status?.worker_online
              ? "● WORKER ONLINE"
              : "● WORKER OFFLINE"}
          </span>

          <h2>一果AI Brain v3</h2>

          <p>
            CSV取込・特徴量生成・再学習・前日版・
            直前版をこの画面から操作できます。
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
        >
          {loading ? "更新中..." : "最新状態へ更新"}
        </button>
      </section>

      <section className="aiStatsGrid">
        <article>
          <span>登録レース</span>
          <strong>
            {Number(
              dashboard?.counts?.races || 0
            ).toLocaleString()}
          </strong>
        </article>

        <article>
          <span>学習特徴量</span>
          <strong>
            {Number(
              dashboard?.counts?.training_features || 0
            ).toLocaleString()}
          </strong>
        </article>

        <article>
          <span>Worker最終通信</span>
          <strong className="aiSmallValue">
            {formatDateTime(
              status?.last_heartbeat_at
            )}
          </strong>
        </article>

        <article>
          <span>最終成功</span>
          <strong className="aiSmallValue">
            {formatDateTime(status?.last_success_at)}
          </strong>
        </article>
      </section>

      <section className="aiSection">
        <div className="aiSectionTitle">
          <div>
            <span>MODEL</span>
            <h2>一果AI モデル成績</h2>
          </div>
        </div>

        <div className="aiModelGrid">
          {[previousModel, afterModel].map(
            (model, index) => (
              <article
                className="aiModelCard"
                key={
                  model?.model_version ||
                  `empty-${index}`
                }
              >
                <div className="aiModelHead">
                  <span>
                    {index === 0
                      ? "前日版"
                      : "直前版"}
                  </span>

                  <b>
                    {model?.model_type || "未登録"}
                  </b>
                </div>

                <h3>
                  {model?.model_version || "モデルなし"}
                </h3>

                <div className="aiMetricGrid">
                  <div>
                    <span>AUC</span>
                    <strong>
                      {metric(model?.auc)}
                    </strong>
                  </div>

                  <div>
                    <span>Brier</span>
                    <strong>
                      {metric(model?.brier_score)}
                    </strong>
                  </div>

                  <div>
                    <span>LogLoss</span>
                    <strong>
                      {metric(model?.log_loss)}
                    </strong>
                  </div>

                  <div>
                    <span>ECE</span>
                    <strong>
                      {metric(
                        model?.calibration_error
                      )}
                    </strong>
                  </div>
                </div>

                <p>
                  学習：
                  {Number(
                    model?.training_race_count || 0
                  ).toLocaleString()}
                  レース
                </p>
              </article>
            )
          )}
        </div>
      </section>

      <section className="aiSection">
        <div className="aiSectionTitle">
          <div>
            <span>UPLOAD</span>
            <h2>CSVアップロード</h2>
          </div>
        </div>

        <div className="aiUploadGrid">
          <CsvUploadCard
            title="学習データ"
            description="過去レースを追加して、AIを育てます。"
            file={trainingFile}
            setFile={setTrainingFile}
            buttonLabel="アップロードして取込"
            loading={
              uploadingType === "training_csv"
            }
            onUpload={() =>
              uploadCsv(
                "training_csv",
                trainingFile
              )
            }
          />

          <CsvUploadCard
            title="一果 前日版"
            description="翌日の出走表CSVから前日信頼度を作ります。"
            file={previousFile}
            setFile={setPreviousFile}
            buttonLabel="前日版を作成"
            loading={
              uploadingType ===
              "previous_day_csv"
            }
            onUpload={() =>
              uploadCsv(
                "previous_day_csv",
                previousFile
              )
            }
          />

          <CsvUploadCard
            title="一果 直前版"
            description="展示・進入・風を含むCSVで直前更新します。"
            file={afterFile}
            setFile={setAfterFile}
            buttonLabel="直前版を作成"
            loading={
              uploadingType ===
              "after_exhibition_csv"
            }
            onUpload={() =>
              uploadCsv(
                "after_exhibition_csv",
                afterFile
              )
            }
          />
        </div>
      </section>

      <section className="aiSection">
        <div className="aiSectionTitle">
          <div>
            <span>ACTION</span>
            <h2>AI操作</h2>
          </div>
        </div>

        <div className="aiActionGrid">
          <ActionButton
            label="特徴量を更新"
            description="登録済みレースから学習特徴量を再生成"
            loading={
              runningJob === "generate_features"
            }
            onClick={() =>
              createJob("generate_features")
            }
          />

          <ActionButton
            label="一果AIを再学習"
            description="Ichika Brain v3 前日版・直前版を再学習"
            loading={
              runningJob === "train_ichika_v3"
            }
            onClick={() =>
              createJob("train_ichika_v3")
            }
          />

          <ActionButton
            label="過去予測を更新"
            description="学習済みモデルで過去レースを再予測"
            loading={
              runningJob ===
              "predict_history_v3"
            }
            onClick={() =>
              createJob("predict_history_v3")
            }
          />

          <ActionButton
            label="学習処理を全部実行"
            description="特徴量更新 → 再学習 → 過去予測"
            primary
            loading={
              runningJob === "run_training_all"
            }
            onClick={() =>
              createJob("run_training_all")
            }
          />
        </div>
      </section>

      <section className="aiSection">
        <div className="aiSectionTitle">
          <div>
            <span>LIVE PREDICTION</span>
            <h2>一果AI 実戦予測</h2>
          </div>
        </div>

        {groupedPredictions.length === 0 ? (
          <div className="aiEmpty">
            未来レースの予測はまだありません。
          </div>
        ) : (
          <div className="aiPredictionList">
            {groupedPredictions.map((item) => {
              const pre =
                item.previous?.calibrated_probability;
              const after =
                item.after?.calibrated_probability;

              const change =
                Number.isFinite(Number(pre)) &&
                Number.isFinite(Number(after))
                  ? (Number(after) - Number(pre)) *
                    100
                  : null;

              const current =
                item.after || item.previous;

              return (
                <article
                  className="aiPredictionCard"
                  key={
                    `${item.race_date}-` +
                    `${item.stadium_code}-` +
                    `${item.race_no}`
                  }
                >
                  <div className="aiRaceTitle">
                    <div>
                      <span>{item.race_date}</span>
                      <h3>
                        {STADIUM_NAMES[
                          item.stadium_code
                        ] ||
                          `場${item.stadium_code}`}
                        {item.race_no}R
                      </h3>
                    </div>

                    <b
                      className={`aiRank aiRank-${
                        current?.confidence_rank ||
                        "D"
                      }`}
                    >
                      {current?.confidence_rank ||
                        "—"}
                    </b>
                  </div>

                  <div className="aiTrustGrid">
                    <div>
                      <span>前日</span>
                      <strong>
                        {percent(pre)}
                      </strong>
                    </div>

                    <div>
                      <span>直前</span>
                      <strong>
                        {percent(after)}
                      </strong>
                    </div>

                    <div>
                      <span>変化</span>
                      <strong
                        className={
                          change > 0
                            ? "aiUp"
                            : change < 0
                            ? "aiDown"
                            : ""
                        }
                      >
                        {change === null
                          ? "—"
                          : `${
                              change > 0 ? "+" : ""
                            }${change.toFixed(1)}pt`}
                      </strong>
                    </div>
                  </div>

                  <FactorList
                    title="プラス要因"
                    factors={
                      current?.positive_factors || []
                    }
                    positive
                  />

                  <FactorList
                    title="注意要因"
                    factors={
                      current?.negative_factors || []
                    }
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="aiSection">
        <div className="aiSectionTitle">
          <div>
            <span>JOB HISTORY</span>
            <h2>処理状況・履歴</h2>
          </div>
        </div>

        <div className="aiJobList">
          {jobs.length === 0 ? (
            <div className="aiEmpty">
              ジョブ履歴はまだありません。
            </div>
          ) : (
            jobs.map((job) => (
              <article
                className="aiJobCard"
                key={job.id}
              >
                <div className="aiJobTop">
                  <div>
                    <strong>
                      {JOB_LABELS[job.job_type] ||
                        job.job_type}
                    </strong>

                    <span>
                      {formatDateTime(job.created_at)}
                    </span>
                  </div>

                  <b
                    className={getStatusClass(
                      job.status
                    )}
                  >
                    {STATUS_LABELS[job.status] ||
                      job.status}
                  </b>
                </div>

                <div className="aiProgress">
                  <span
                    style={{
                      width: `${Number(
                        job.progress || 0
                      )}%`,
                    }}
                  />
                </div>

                <p>
                  {job.error_message ||
                    job.message ||
                    "処理待ち"}
                </p>

                {job.worker_name && (
                  <small>
                    Worker：{job.worker_name}
                  </small>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function CsvUploadCard({
  title,
  description,
  file,
  setFile,
  buttonLabel,
  loading,
  onUpload,
}) {
  return (
    <article className="aiUploadCard">
      <h3>{title}</h3>
      <p>{description}</p>

      <label>
        <span>CSVファイル</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) =>
            setFile(
              event.target.files?.[0] || null
            )
          }
        />
      </label>

      {file && (
        <div className="aiSelectedFile">
          <strong>{file.name}</strong>
          <span>
            {(file.size / 1024 / 1024).toFixed(2)}
            MB
          </span>
        </div>
      )}

      <button
        type="button"
        disabled={loading || !file}
        onClick={onUpload}
      >
        {loading ? "アップロード中..." : buttonLabel}
      </button>
    </article>
  );
}

function ActionButton({
  label,
  description,
  loading,
  primary,
  onClick,
}) {
  return (
    <button
      type="button"
      className={
        primary
          ? "aiActionButton aiActionPrimary"
          : "aiActionButton"
      }
      disabled={loading}
      onClick={onClick}
    >
      <strong>
        {loading ? "依頼登録中..." : label}
      </strong>
      <span>{description}</span>
    </button>
  );
}

function FactorList({
  title,
  factors,
  positive = false,
}) {
  if (!Array.isArray(factors) || factors.length === 0) {
    return null;
  }

  return (
    <div
      className={
        positive
          ? "aiFactors aiFactorsPositive"
          : "aiFactors aiFactorsNegative"
      }
    >
      <strong>{title}</strong>

      <ul>
        {factors.slice(0, 5).map((factor, index) => (
          <li key={`${factor.label}-${index}`}>
            {factor.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
