'use client';

import { useEffect, useState } from 'react';
import styles from './engineV3Admin.module.css';

const STADIUMS = [
  '桐生','戸田','江戸川','平和島','多摩川','浜名湖','蒲郡','常滑','津','三国','びわこ','住之江',
  '尼崎','鳴門','丸亀','児島','宮島','徳山','下関','若松','芦屋','福岡','唐津','大村',
];

export default function EngineV3AdminClient() {
  const [courseCode, setCourseCode] = useState(1);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadStatus() {
    const response = await fetch('/api/admin/engine-v3/refresh', { cache: 'no-store' });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || '状態確認に失敗しました。');
    setStatus(json.status);
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

  return <main className={styles.page}>
    <header><small>BOATSTRIKERS ADMIN</small><h1>Engine v3 管理</h1><p>過去1年DATA BOOK・展示AI・24場集計を統一して更新します。</p></header>
    <section className={styles.card}>
      <label>集計基準日<input type="date" value={asOf} onChange={event => setAsOf(event.target.value)} /></label>
      <label>対象場<select value={courseCode} onChange={event => setCourseCode(Number(event.target.value))}>{STADIUMS.map((name, index) => <option value={index + 1} key={name}>#{String(index + 1).padStart(2, '0')} {name}</option>)}</select></label>
      <div className={styles.actions}><button onClick={() => refresh('single')} disabled={busy}>選択した1場を更新</button><button className={styles.allButton} onClick={() => refresh('all')} disabled={busy}>24場すべて更新</button></div>
      {message && <div className={styles.message}>{message}</div>}
    </section>
    <section className={styles.status}>
      <h2>Engine状態</h2>
      <div><span>集計済み場数</span><b>{status?.stadium_snapshots ?? '—'}</b></div>
      <div><span>最新集計</span><b>{status?.latest_snapshot ? new Date(status.latest_snapshot).toLocaleString('ja-JP') : '—'}</b></div>
      <div><span>本日のレース</span><b>{status?.today_events ?? '—'}R</b></div>
      <div><span>本日の出走艇</span><b>{status?.today_entries ?? '—'}艇</b></div>
      <pre>{JSON.stringify(status?.latest_run || {}, null, 2)}</pre>
    </section>
  </main>;
}
