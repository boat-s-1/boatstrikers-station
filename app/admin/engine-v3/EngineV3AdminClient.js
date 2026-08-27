'use client';

import { useEffect, useState } from 'react';
import styles from './engineV3Admin.module.css';

const STADIUMS = [
  '桐生','戸田','江戸川','平和島','多摩川','浜名湖','蒲郡','常滑','津','三国','びわこ','住之江',
  '尼崎','鳴門','丸亀','児島','宮島','徳山','下関','若松','芦屋','福岡','唐津','大村',
];

function fmtDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
  }).format(new Date(value));
}

export default function EngineV3AdminClient() {
  const [courseCode, setCourseCode] = useState(1);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadStatus() {
    const response = await fetch('/api/admin/engine-v3/refresh', { cache: 'no-store' });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || '状態確認に失敗しました。');
    setStatus(json.status);
    setWeekly(json.weekly || null);
  }

  useEffect(() => { loadStatus().catch(error => setMessage(error.message)); }, []);

  async function refresh(scope) {
    setBusy(true);
    setMessage(scope === 'all' ? '24場を再集計しています…' : `${STADIUMS[courseCode - 1]}を再集計しています…`);
    try {
      const response = await fetch('/api/admin/engine-v3/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, courseCode, asOf }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || '再集計に失敗しました。');
      if (scope === 'all') {
        const success = (json.rows || []).filter(row => row.success).length;
        const failed = (json.rows || []).filter(row => !row.success).length;
        setMessage(`完了：成功 ${success}場 / 失敗 ${failed}場`);
      } else {
        setMessage(`完了：${STADIUMS[courseCode - 1]} ${(json.result?.race_count || 0).toLocaleString()}R`);
      }
      await loadStatus();
    } catch (error) {
      setMessage(`エラー：${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  const allOk = weekly?.success_count === 24 && weekly?.failed_count === 0;

  return <main className={styles.page}>
    <header><small>BOATSTRIKERS ADMIN</small><h1>Engine v3 管理</h1><p>過去1年DATA BOOK・展示AI・24場集計を統一して更新します。</p></header>

    <section className={styles.weeklyPanel}>
      <div className={styles.weeklyHeader}>
        <div><small>AUTO AGGREGATION</small><h2>24場 自動集計ステータス</h2></div>
        <span className={allOk ? styles.okBadge : styles.warnBadge}>{allOk ? '24/24 OK' : `${weekly?.success_count ?? 0}/24`}</span>
      </div>
      <div className={styles.summaryCards}>
        <article><span>次回自動集計</span><strong>{fmtDateTime(weekly?.next_run_at)}</strong><small>{weekly?.schedule_label || '毎週月曜 4:00 JST'}</small></article>
        <article><span>前回集計基準日</span><strong>{weekly?.latest_batch_date || '—'}</strong><small>直近365日を再集計</small></article>
        <article><span>前回成功日時</span><strong>{fmtDateTime(weekly?.latest_success_at)}</strong><small>最新の成功ログ</small></article>
        <article><span>24場結果</span><strong><b className={styles.successText}>{weekly?.success_count ?? '—'}成功</b> / <b className={styles.failText}>{weekly?.failed_count ?? '—'}失敗</b></strong><small>場別ステータスを下に表示</small></article>
      </div>

      <div className={styles.stadiumGrid}>
        {(weekly?.stadiums || []).map((row) => (
          <article key={row.course_code} className={row.success ? styles.stadiumOk : styles.stadiumFail}>
            <div><b>#{String(row.course_code).padStart(2, '0')}</b><strong>{STADIUMS[row.course_code - 1]}</strong></div>
            <span>{row.success ? '✓ 成功' : '× 失敗'}</span>
            <small>基準日 {row.as_of_date || '—'}</small>
            <small>{row.race_count != null ? `${Number(row.race_count).toLocaleString()}R` : 'レース数 —'}</small>
            <small>更新 {fmtDateTime(row.finished_at)}</small>
          </article>
        ))}
      </div>
    </section>

    <section className={styles.card}>
      <h2>手動再集計</h2>
      <label>集計基準日<input type="date" value={asOf} onChange={event => setAsOf(event.target.value)} /></label>
      <label>対象場<select value={courseCode} onChange={event => setCourseCode(Number(event.target.value))}>{STADIUMS.map((name, index) => <option value={index + 1} key={name}>#{String(index + 1).padStart(2, '0')} {name}</option>)}</select></label>
      <div className={styles.actions}><button onClick={() => refresh('single')} disabled={busy}>選択した1場を更新</button><button className={styles.allButton} onClick={() => refresh('all')} disabled={busy}>24場すべて更新</button></div>
      {message && <div className={styles.message}>{message}</div>}
    </section>

    <section className={styles.status}>
      <h2>Engine状態</h2>
      <div><span>集計済み場数</span><b>{status?.stadium_snapshots ?? '—'}</b></div>
      <div><span>最新スナップショット</span><b>{status?.latest_snapshot ? fmtDateTime(status.latest_snapshot) : '—'}</b></div>
      <div><span>本日のレース</span><b>{status?.today_events ?? '—'}R</b></div>
      <div><span>本日の出走艇</span><b>{status?.today_entries ?? '—'}艇</b></div>
    </section>
  </main>;
}
