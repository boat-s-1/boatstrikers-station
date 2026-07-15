"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./ai-v5.css";

const JOB_LABELS = {
  import_training_csv: "学習CSV取込",
  generate_features: "特徴量更新",
  train_ichika_v3: "一果AI再学習",
  predict_history_v3: "過去予測更新",
  run_training_all: "学習処理を全部実行",
  run_previous_day: "前日版を作成",
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
  1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",
  7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",
  13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",
  19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村",
};

function pct(value, digits = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(digits)}%` : "—";
}

function num(value, digits = 4) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "—";
}

function dateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function BoatStrikersAiV5Page() {
  const [accessKey, setAccessKey] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [targetDate, setTargetDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [runningJob, setRunningJob] = useState("");
  const [uploading, setUploading] = useState("");
  const [trainingFile, setTrainingFile] = useState(null);
  const [previousFile, setPreviousFile] = useState(null);
  const [afterFile, setAfterFile] = useState(null);
  const [resultRace, setResultRace] = useState(null);
  const [winnerBoatNo, setWinnerBoatNo] = useState("");
  const [finishOrder, setFinishOrder] = useState("");
  const [payout, setPayout] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("bsc-ai-admin-key");
    if (saved) {
      setAccessKey(saved);
      setAuthorized(true);
    }
  }, []);

  const apiFetch = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        "x-bsc-ai-key": accessKey,
      },
      cache: "no-store",
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json?.error || "通信に失敗しました");
    return json;
  }, [accessKey]);

  const load = useCallback(async () => {
    if (!authorized || !accessKey) return;
    setLoading(true);
    try {
      const json = await apiFetch(
        `/api/bsc2/ai/v5-dashboard?date=${encodeURIComponent(targetDate)}`
      );
      setData(json);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accessKey, apiFetch, authorized, targetDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!authorized) return;
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [authorized, load]);

  const login = () => {
    if (!accessKey.trim()) {
      setError("AI管理キーを入力してください");
      return;
    }
    sessionStorage.setItem("bsc-ai-admin-key", accessKey.trim());
    setAuthorized(true);
    setError("");
  };

  const logout = () => {
    sessionStorage.removeItem("bsc-ai-admin-key");
    setAuthorized(false);
    setData(null);
    setAccessKey("");
  };

  const createJob = async (jobType) => {
    setRunningJob(jobType);
    try {
      await apiFetch("/api/bsc2/ai/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_type: jobType }),
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunningJob("");
    }
  };

  const uploadCsv = async (fileType, file) => {
    if (!file) {
      setError("CSVファイルを選択してください");
      return;
    }
    setUploading(fileType);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("file_type", fileType);
      await apiFetch("/api/bsc2/ai/upload", {
        method: "POST",
        body: form,
      });
      if (fileType === "training_csv") setTrainingFile(null);
      if (fileType === "previous_day_csv") setPreviousFile(null);
      if (fileType === "after_exhibition_csv") setAfterFile(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading("");
    }
  };

  const saveResult = async () => {
    if (!resultRace) return;
    try {
      await apiFetch("/api/bsc2/ai/live-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upcoming_race_id: resultRace.upcoming_race_id,
          winner_boat_no: winnerBoatNo,
          finish_order: finishOrder,
          payout_3t: payout,
        }),
      });
      setResultRace(null);
      setWinnerBoatNo("");
      setFinishOrder("");
      setPayout("");
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const activeModels = useMemo(
    () => (data?.models || []).filter((model) => model.is_active),
    [data]
  );

  if (!authorized) {
    return (
      <main className="v5Page">
        <section className="v5Login">
          <div>🤖</div>
          <p>BOAT STRIKERS AI v5</p>
          <h1>AI管理画面</h1>
          <input
            type="password"
            value={accessKey}
            placeholder="AI管理キー"
            onChange={(event) => setAccessKey(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && login()}
          />
          {error && <strong>{error}</strong>}
          <button type="button" onClick={login}>AI管理画面を開く</button>
          <Link href="/bsc2/admin">← 通常の管理画面へ戻る</Link>
        </section>
      </main>
    );
  }

  const status = data?.system_status;
  const summary = data?.summary || {};
  const ranking = data?.ranking || [];
  const jobs = data?.jobs || [];

  return (
    <main className="v5Page">
      <header className="v5Header">
        <Link href="/bsc2/admin">←</Link>
        <div>
          <p>BOAT STRIKERS AI v5</p>
          <h1>AI CONTROL CENTER</h1>
        </div>
        <button type="button" onClick={logout}>ログアウト</button>
      </header>

      {error && <div className="v5Error">{error}</div>}

      <section className="v5Hero">
        <div>
          <span className={status?.worker_online ? "v5Online" : "v5Offline"}>
            ● WORKER {status?.worker_online ? "ONLINE" : "OFFLINE"}
          </span>
          <h2>一果AI Brain v3</h2>
          <p>予測・ランキング・成績・学習を1画面で管理します。</p>
        </div>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "更新中..." : "最新状態へ更新"}
        </button>
      </section>

      <nav className="v5Tabs">
        {[
          ["dashboard", "Dashboard"],
          ["ranking", "今日の予測"],
          ["models", "モデル比較"],
          ["operations", "CSV・学習"],
          ["jobs", "処理履歴"],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && (
        <>
          <section className="v5Stats">
            <Stat label="登録レース" value={Number(data?.counts?.races || 0).toLocaleString()} />
            <Stat label="学習特徴量" value={Number(data?.counts?.training_features || 0).toLocaleString()} />
            <Stat label="本日の予測" value={summary.prediction_count || 0} />
            <Stat label="S以上" value={summary.ss_count || 0} />
            <Stat label="結果確定" value={summary.settled_count || 0} />
            <Stat label="正解数" value={summary.correct_count || 0} />
          </section>

          <Section title="本日の信頼度ランキング">
            <DateSelector value={targetDate} onChange={setTargetDate} />
            <Ranking rows={ranking.slice(0, 10)} onResult={setResultRace} />
          </Section>

          <Section title="現行モデル">
            <div className="v5ModelGrid">
              {activeModels.map((model) => (
                <ModelCard key={model.model_version} model={model} />
              ))}
            </div>
          </Section>

          <Section title="実戦成績">
            <Performance rows={data?.live_performance || []} />
          </Section>
        </>
      )}

      {tab === "ranking" && (
        <Section title="今日の予測一覧">
          <DateSelector value={targetDate} onChange={setTargetDate} />
          <Ranking rows={ranking} onResult={setResultRace} expanded />
        </Section>
      )}

      {tab === "models" && (
        <Section title="モデル比較">
          <ModelComparison rows={data?.model_comparison || []} />
        </Section>
      )}

      {tab === "operations" && (
        <>
          <Section title="CSVアップロード">
            <div className="v5UploadGrid">
              <Upload
                title="学習データ"
                file={trainingFile}
                setFile={setTrainingFile}
                loading={uploading === "training_csv"}
                onClick={() => uploadCsv("training_csv", trainingFile)}
                button="アップロードして取込"
              />
              <Upload
                title="一果 前日版"
                file={previousFile}
                setFile={setPreviousFile}
                loading={uploading === "previous_day_csv"}
                onClick={() => uploadCsv("previous_day_csv", previousFile)}
                button="前日版を作成"
              />
              <Upload
                title="一果 直前版"
                file={afterFile}
                setFile={setAfterFile}
                loading={uploading === "after_exhibition_csv"}
                onClick={() => uploadCsv("after_exhibition_csv", afterFile)}
                button="直前版を作成"
              />
            </div>
          </Section>

          <Section title="AI操作">
            <div className="v5ActionGrid">
              <Action label="特徴量を更新" loading={runningJob === "generate_features"}
                onClick={() => createJob("generate_features")} />
              <Action label="一果AIを再学習" loading={runningJob === "train_ichika_v3"}
                onClick={() => createJob("train_ichika_v3")} />
              <Action label="過去予測を更新" loading={runningJob === "predict_history_v3"}
                onClick={() => createJob("predict_history_v3")} />
              <Action label="学習処理を全部実行" primary loading={runningJob === "run_training_all"}
                onClick={() => createJob("run_training_all")} />
            </div>
          </Section>
        </>
      )}

      {tab === "jobs" && (
        <Section title="処理状況・履歴">
          <div className="v5JobList">
            {jobs.map((job) => (
              <article className="v5Job" key={job.id}>
                <div>
                  <strong>{JOB_LABELS[job.job_type] || job.job_type}</strong>
                  <span>{dateTime(job.created_at)}</span>
                </div>
                <b className={`v5Status ${job.status}`}>
                  {STATUS_LABELS[job.status] || job.status}
                </b>
                <div className="v5Progress">
                  <span style={{ width: `${job.progress || 0}%` }} />
                </div>
                <p>{job.error_message || job.message || "処理待ち"}</p>
              </article>
            ))}
          </div>
        </Section>
      )}

      {resultRace && (
        <div className="v5Modal" onClick={() => setResultRace(null)}>
          <div className="v5ModalBox" onClick={(event) => event.stopPropagation()}>
            <h3>
              {STADIUM_NAMES[resultRace.stadium_code] || `場${resultRace.stadium_code}`}
              {resultRace.race_no}R 結果登録
            </h3>
            <label>1着艇
              <select value={winnerBoatNo} onChange={(event) => setWinnerBoatNo(event.target.value)}>
                <option value="">未入力</option>
                {[1,2,3,4,5,6].map((boat) => <option key={boat} value={boat}>{boat}号艇</option>)}
              </select>
            </label>
            <label>3連単
              <input value={finishOrder} placeholder="例：1-2-3"
                onChange={(event) => setFinishOrder(event.target.value)} />
            </label>
            <label>3連単払戻
              <input type="number" value={payout} placeholder="例：1450"
                onChange={(event) => setPayout(event.target.value)} />
            </label>
            <div>
              <button type="button" onClick={() => setResultRace(null)}>キャンセル</button>
              <button type="button" onClick={saveResult}>結果を保存</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Section({ title, children }) {
  return <section className="v5Section"><h2>{title}</h2>{children}</section>;
}

function Stat({ label, value }) {
  return <article><span>{label}</span><strong>{value}</strong></article>;
}

function DateSelector({ value, onChange }) {
  return (
    <div className="v5Date">
      <label>対象日</label>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Ranking({ rows, onResult, expanded = false }) {
  if (!rows.length) return <div className="v5Empty">この日の予測はありません。</div>;
  return (
    <div className="v5Ranking">
      {rows.map((row, index) => (
        <article key={row.upcoming_race_id}>
          <div className="v5Place">{index + 1}</div>
          <div className="v5Race">
            <span>{row.race_date}</span>
            <strong>
              {STADIUM_NAMES[row.stadium_code] || `場${row.stadium_code}`}
              {row.race_no}R
            </strong>
          </div>
          <div className="v5Probability">{pct(row.current_probability)}</div>
          <div className="v5Rank">{row.current_rank || "—"}</div>
          <div className="v5Change">
            {row.change_point === null ? "—" :
              `${Number(row.change_point) > 0 ? "+" : ""}${row.change_point}pt`}
          </div>
          <button type="button" onClick={() => onResult(row)}>
            {row.escape_success === null ? "結果登録" : row.escape_success ? "イン逃げ" : "イン敗北"}
          </button>
          {expanded && (
            <div className="v5Factors">
              <span>＋ {(row.positive_factors || []).slice(0, 3).map((x) => x.label).join(" / ") || "—"}</span>
              <span>⚠ {(row.negative_factors || []).slice(0, 3).map((x) => x.label).join(" / ") || "—"}</span>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function ModelCard({ model }) {
  return (
    <article className="v5Card">
      <div><strong>{model.data_timing === "previous_day" ? "前日版" : "直前版"}</strong><span>{model.model_type}</span></div>
      <h3>{model.model_version}</h3>
      <dl>
        <div><dt>AUC</dt><dd>{num(model.auc)}</dd></div>
        <div><dt>Brier</dt><dd>{num(model.brier_score)}</dd></div>
        <div><dt>LogLoss</dt><dd>{num(model.log_loss)}</dd></div>
        <div><dt>ECE</dt><dd>{num(model.calibration_error)}</dd></div>
      </dl>
    </article>
  );
}

function Performance({ rows }) {
  if (!rows.length) return <div className="v5Empty">結果登録後に実戦成績が表示されます。</div>;
  return (
    <div className="v5TableWrap">
      <table>
        <thead><tr><th>タイミング</th><th>確定</th><th>正解</th><th>正解率</th><th>Brier</th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={`${row.data_timing}-${row.model_version}`}>
            <td>{row.data_timing === "previous_day" ? "前日版" : "直前版"}</td>
            <td>{row.settled_races}</td><td>{row.correct_races}</td>
            <td>{row.accuracy_percent ?? "—"}%</td><td>{row.brier_score ?? "—"}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function ModelComparison({ rows }) {
  return (
    <div className="v5TableWrap">
      <table>
        <thead><tr><th>モデル</th><th>種別</th><th>AUC</th><th>Brier</th><th>LogLoss</th><th>ECE</th><th>学習数</th></tr></thead>
        <tbody>{rows.map((row) => (
          <tr key={`${row.model_version}-${row.data_timing}`}>
            <td>{row.model_version}</td>
            <td>{row.data_timing === "previous_day" ? "前日" : "直前"}</td>
            <td>{num(row.auc)}</td><td>{num(row.brier_score)}</td>
            <td>{num(row.log_loss)}</td><td>{num(row.calibration_error)}</td>
            <td>{Number(row.training_race_count || 0).toLocaleString()}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Upload({ title, file, setFile, loading, onClick, button }) {
  return (
    <article className="v5Card v5Upload">
      <h3>{title}</h3>
      <input type="file" accept=".csv,text/csv"
        onChange={(event) => setFile(event.target.files?.[0] || null)} />
      {file && <p>{file.name}</p>}
      <button type="button" disabled={loading || !file} onClick={onClick}>
        {loading ? "処理中..." : button}
      </button>
    </article>
  );
}

function Action({ label, loading, onClick, primary }) {
  return (
    <button type="button" className={`v5Action ${primary ? "primary" : ""}`}
      disabled={loading} onClick={onClick}>
      {loading ? "依頼登録中..." : label}
    </button>
  );
}
