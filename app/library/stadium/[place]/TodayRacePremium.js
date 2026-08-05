'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './stadiumAiV2.module.css';

const pct = value => value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value).toFixed(1)}%`;
const num = value => value == null || value === '' ? '—' : Number(value).toFixed(2);
const scoreLabel = score => score >= 85 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D';

export default function TodayRacePremium({ place, stadiumName }) {
  const [data, setData] = useState(null);
  const [selectedRace, setSelectedRace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastChecked, setLastChecked] = useState(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/stadium/today/${encodeURIComponent(place)}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || '今日のレース情報を取得できませんでした。');
      setData(json);
      setSelectedRace(current => {
        if (current && json.races?.some(item => item.raceNo === current)) return current;
        const firstOpen = json.races?.find(item => item.status !== 'result')?.raceNo;
        return firstOpen || json.races?.[0]?.raceNo || null;
      });
      setLastChecked(new Date());
      setError('');
    } catch (e) {
      setError(e.message || '取得に失敗しました。');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [place]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load({ quiet: true }), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const race = useMemo(() => data?.races?.find(item => item.raceNo === selectedRace), [data, selectedRace]);

  return <section className={styles.todayPremiumPanel}>
    <div className={styles.todayHeader}>
      <div>
        <small>PREMIUM / TODAY&apos;S RACE</small>
        <h2>今日の{stadiumName}・直前攻略</h2>
        <p>出走表を先行表示し、展示・風・進入が入ると直前版へ自動更新します。</p>
      </div>
      <button type="button" className={styles.refreshButton} onClick={() => load()} disabled={loading}>
        {loading ? '更新中…' : '最新情報に更新'}
      </button>
    </div>

    {error && <div className={styles.todayError}>{error}</div>}
    {!error && loading && !data && <div className={styles.todayEmpty}>今日の出走表を読み込んでいます…</div>}
    {!loading && !error && !data?.races?.length && <div className={styles.todayEmpty}>本日の開催データはまだありません。</div>}

    {data?.races?.length > 0 && <>
      <div className={styles.todayMeta}>
        <span>{data.raceDate}</span>
        <span>最終データ {formatTime(data.generatedAt)}</span>
        <span>自動確認 60秒ごと</span>
      </div>

      <div className={styles.raceTabs}>
        {data.races.map(item => <button key={item.raceNo} type="button" onClick={() => setSelectedRace(item.raceNo)} className={selectedRace === item.raceNo ? styles.activeRaceTab : ''}>
          <b>{item.raceNo}R</b>
          <small>{item.phase === 'live' ? '直前' : item.phase === 'waiting' ? '展示待ち' : '前日'}</small>
        </button>)}
      </div>

      {race && <div className={styles.todayRaceBody}>
        <div className={styles.raceSummaryHead}>
          <div>
            <span className={`${styles.phaseBadge} ${race.phase === 'live' ? styles.phaseLive : ''}`}>{race.phaseLabel}</span>
            <h3>{stadiumName} {race.raceNo}R</h3>
            <p>{race.deadline ? `締切予定 ${race.deadline}` : '締切時刻未登録'}{race.windLabel ? ` ・ ${race.windLabel}` : ''}</p>
          </div>
          <div className={styles.updateStamp}>{race.phase === 'live' ? '展示反映済み' : '展示発表後に自動更新'}</div>
        </div>

        <div className={styles.raceScoreGrid}>
          <RaceScore label="イン信頼度" score={race.scores.inside} before={race.beforeScores?.inside} />
          <RaceScore label="穴期待度" score={race.scores.upset} before={race.beforeScores?.upset} />
          <RaceScore label="展示評価" score={race.scores.exhibition} before={race.beforeScores?.exhibition} />
          <RaceScore label="風影響度" score={race.scores.wind} before={race.beforeScores?.wind} />
        </div>

        <div className={styles.raceVerdict}>
          <div><small>現在の判定</small><strong>{race.verdict}</strong></div>
          <div><small>注目艇</small><strong>{race.recommendedBoat ? `${race.recommendedBoat}号艇` : '分析中'}</strong></div>
          <div><small>評価段階</small><strong>{scoreLabel(race.scores.inside)}</strong></div>
        </div>

        {race.reasons?.length > 0 && <div className={styles.reasonBox}>
          <h4>{race.phase === 'live' ? '直前評価の根拠' : '展示前評価の根拠'}</h4>
          <ul>{race.reasons.map((reason, index) => <li key={`${reason}-${index}`}>✓ {reason}</li>)}</ul>
          {race.sampleCount != null && <p>類似条件の参考母数：{Number(race.sampleCount).toLocaleString()}件</p>}
        </div>}

        <div className={styles.entryList}>
          {race.entries.map(entry => <article key={entry.boatNo} className={`${styles.entryCard} ${entry.boatNo === 1 ? styles.entryCardInside : ''}`}>
            <div className={`${styles.entryBoatNo} ${styles[`entryBoat${entry.boatNo}`]}`}>{entry.boatNo}</div>
            <div className={styles.entryMain}>
              <div className={styles.entryName}><strong>{entry.racerName || '選手名未登録'}</strong><span>{entry.racerClass || '—'}</span></div>
              <div className={styles.entryMetrics}>
                <span><small>全国</small><b>{num(entry.nationalWinRate)}</b></span>
                <span><small>当地</small><b>{num(entry.localWinRate)}</b></span>
                <span><small>モーター</small><b>{pct(entry.motor2Rate)}</b></span>
                <span><small>平均ST</small><b>{entry.avgSt != null ? num(entry.avgSt) : '—'}</b></span>
              </div>
              {race.phase === 'live' && <div className={styles.exhibitionMetrics}>
                <span><small>展示</small><b>{entry.exhibitionTime != null ? num(entry.exhibitionTime) : '—'}</b><em>{entry.exhibitionRank ? `${entry.exhibitionRank}位` : ''}</em></span>
                <span><small>展示ST</small><b>{entry.exhibitionSt != null ? num(entry.exhibitionSt) : '—'}</b></span>
                <span><small>展示進入</small><b>{entry.exhibitionCourse || '—'}</b></span>
                <span><small>直前評価</small><b>{entry.liveScore ?? '—'}</b></span>
              </div>}
            </div>
          </article>)}
        </div>

        <p className={styles.todayDisclaimer}>過去データと当日情報を組み合わせた参考評価です。結果を保証するものではありません。</p>
      </div>}
      {lastChecked && <p className={styles.clientChecked}>画面確認 {lastChecked.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</p>}
    </>}
  </section>;
}

function RaceScore({ label, score, before }) {
  const value = Math.max(0, Math.min(100, Number(score || 0)));
  const changed = before != null && Number(before) !== value;
  return <article className={styles.liveScoreCard}>
    <span>{label}</span>
    <strong>{Math.round(value)}<small>点</small></strong>
    {changed && <em>{Math.round(Number(before))} → {Math.round(value)}</em>}
    <div><i style={{ width: `${value}%` }} /></div>
  </article>;
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}
