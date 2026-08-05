'use client';

import { useMemo, useState } from 'react';
import styles from './stadiumAiV2.module.css';

const pct = (value) => value == null ? '—' : `${Number(value).toFixed(1)}%`;
const yen = (value) => value == null ? '—' : `${Number(value).toLocaleString()}円`;

export default function DataBookInteractive({ seasonalStats = [], windStats = [], trifectaStats = [] }) {
  const seasonOrder = ['春', '夏', '秋', '冬'];
  const seasons = useMemo(() => seasonOrder.map(name => seasonalStats.find(x => x.season === name)).filter(Boolean), [seasonalStats]);
  const [season, setSeason] = useState(seasons[0]?.season || '春');
  const [wind, setWind] = useState(0);
  const activeSeason = seasons.find(x => x.season === season);
  const activeWind = windStats[wind];
  const maxRate = Math.max(1, ...trifectaStats.slice(0, 12).map(x => Number(x.rate || 0)));

  return <>
    <section className={styles.panel}>
      <div className={styles.sectionHeading}>
        <div><span>03</span><small>FREE DATA</small></div>
        <div><p>TRIFECTA HEATMAP</p><h2>3連単・出目ランキング</h2></div>
      </div>
      {trifectaStats.length ? <div className={styles.trifectaGrid}>
        {trifectaStats.slice(0, 12).map((item, index) => {
          const strength = Math.max(12, Math.round(Number(item.rate || 0) / maxRate * 100));
          return <article className={styles.trifectaCard} key={item.combo}>
            <div className={styles.rankBadge}>{index + 1}</div>
            <strong>{item.combo}</strong>
            <div className={styles.heatTrack}><i style={{ width: `${strength}%` }} /></div>
            <dl>
              <div><dt>出現率</dt><dd>{pct(item.rate)}</dd></div>
              <div><dt>平均配当</dt><dd>{yen(item.avg_payout)}</dd></div>
              <div><dt>万舟率</dt><dd>{pct(item.over10000_rate)}</dd></div>
            </dl>
          </article>;
        })}
      </div> : <div className={styles.empty}>出目データを集計中です。</div>}
    </section>

    <section className={styles.panel}>
      <div className={styles.sectionHeading}>
        <div><span>04</span><small>FREE DATA</small></div>
        <div><p>SEASON ANALYSIS</p><h2>季節別データ</h2></div>
      </div>
      {seasons.length ? <>
        <div className={styles.tabRow}>
          {seasons.map(item => <button key={item.season} type="button" className={season === item.season ? styles.activeTab : ''} onClick={() => setSeason(item.season)}>{item.season}</button>)}
        </div>
        {activeSeason && <div className={styles.tabContent}>
          <div className={styles.tabHero}><small>{activeSeason.season}の傾向</small><strong>{Number(activeSeason.sample_count || 0).toLocaleString()}R</strong></div>
          <div className={styles.miniMetrics}>
            <Metric label="1コース1着率" value={pct(activeSeason.course1_win_rate)} />
            <Metric label="イン逃げ率" value={pct(activeSeason.inside_escape_rate)} />
            <Metric label="平均3連単" value={yen(activeSeason.avg_payout)} />
            <Metric label="万舟率" value={pct(activeSeason.over10000_rate)} />
          </div>
        </div>}
      </> : <div className={styles.empty}>季節別データを集計中です。</div>}
    </section>

    <section className={styles.panel}>
      <div className={styles.sectionHeading}>
        <div><span>05</span><small>PREMIUM PREVIEW</small></div>
        <div><p>WIND ANALYSIS</p><h2>風向き・風速データ</h2></div>
      </div>
      {windStats.length ? <>
        <div className={styles.tabRow}>
          {windStats.map((item, index) => <button key={`${item.direction}-${item.speed_band}-${index}`} type="button" className={wind === index ? styles.activeTab : ''} onClick={() => setWind(index)}>{item.direction}<small>{item.speed_band}</small></button>)}
        </div>
        {activeWind && <div className={styles.tabContent}>
          <div className={styles.tabHero}><small>{activeWind.direction}・{activeWind.speed_band}</small><strong>{Number(activeWind.sample_count || 0).toLocaleString()}R</strong></div>
          <div className={styles.miniMetrics}>
            <Metric label="1コース1着率" value={pct(activeWind.course1_win_rate)} />
            <Metric label="イン逃げ率" value={pct(activeWind.inside_escape_rate)} />
            <Metric label="平均3連単" value={yen(activeWind.avg_payout)} />
            <Metric label="万舟率" value={pct(activeWind.over10000_rate)} />
          </div>
        </div>}
      </> : <div className={styles.empty}>風データはData Engine v3実行後に表示されます。</div>}
    </section>
  </>;
}

function Metric({ label, value }) {
  return <div className={styles.miniMetric}><span>{label}</span><strong>{value}</strong></div>;
}
