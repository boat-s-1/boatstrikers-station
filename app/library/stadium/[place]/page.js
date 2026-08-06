import Link from 'next/link';
import { getStadiumAiV2, premiumPreview, STADIUMS } from '../../../../lib/stadiumAiV2';
import DataBookInteractive from './DataBookInteractive';
import TodayRacePremium from './TodayRacePremium';
import styles from './stadiumAiV2.module.css';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return STADIUMS.map(stadium => ({ place: stadium.slug }));
}

export async function generateMetadata({ params }) {
  const route = await params;
  const stadium = STADIUMS.find(item => item.slug === route.place) || STADIUMS[0];
  return {
    title: `${stadium.name} DATA BOOK｜BoatStrikers 24場攻略`,
    description: `${stadium.name}の直近1年データ、出目、季節、風、展示AI、今日の出走表と直前評価を掲載します。`,
  };
}

const pct = value => value == null ? '—' : `${Number(value).toFixed(1)}%`;
const yen = value => value == null ? '—' : `${Number(value).toLocaleString()}円`;
const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value || 0))));

export default async function StadiumDataBookPage({ params, searchParams }) {
  const route = await params;
  const query = await searchParams;
  const { stadium, payload, error, generatedAt } = await getStadiumAiV2(route.place);
  const premium = premiumPreview(query);
  const yearly = payload?.yearly_stats || {};
  const profile = payload?.ai_profile || buildFallbackProfile(yearly);
  const source = payload?.source_health || {};

  return <main className={styles.page} data-stadium={stadium.slug} style={{ '--stadium-code': `'${String(stadium.courseCode).padStart(2, '0')}'` }}>
    <header className={styles.topbar}>
      <Link href="/library/stadiums">← 24場攻略</Link>
      <span>BOATSTRIKERS DATA BOOK</span>
    </header>

    <section className={styles.cover}>
      <div className={styles.coverCopy}>
        <small>BOATSTRIKERS DATA BOOK / 2026 EDITION</small>
        <h1><span>#{String(stadium.courseCode).padStart(2, '0')}</span>{stadium.name}</h1>
        <p>{stadium.englishName}</p>
        <div className={styles.coverMeta}>
          <b>{Number(payload?.race_count || 0).toLocaleString()}R ANALYZED</b>
          <span>最終更新 {payload?.updated_at_label || '未集計'}</span>
          <span>{payload?.aggregation_from || '—'}〜{payload?.aggregation_to || '—'}</span>
        </div>
      </div>
      <div className={styles.coverScore}>
        <span>AI総合評価</span>
        <strong>{profile.overall_score ?? '—'}</strong>
        <Stars value={profile.overall_score} />
      </div>
      <i className={styles.coverNumber}>{String(stadium.courseCode).padStart(2, '0')}</i>
    </section>

    {error && <div className={styles.error}>{error}</div>}
    {source.message && <div className={styles.sourceNotice}><b>DATA STATUS</b><span>{source.message}</span><small>収録 {source.date_count || 0}日 / {source.min_date || '—'}〜{source.max_date || '—'}</small></div>}

    <section className={styles.dashboard}>
      <div className={styles.dashboardHeader}>
        <div><small>AI DASHBOARD</small><h2>{stadium.name}を30秒で読む</h2></div>
        <span className={styles.difficulty}>攻略難易度 <b>{profile.difficulty_label || '分析中'}</b></span>
      </div>
      <div className={styles.scoreGrid}>
        <ScoreCard label="イン信頼度" value={profile.inside_score} icon="1" note="1コース・逃げ傾向" />
        <ScoreCard label="穴期待度" value={profile.upset_score} icon="穴" note="万舟・イン不成立傾向" />
        <ScoreCard label="展示重要度" value={profile.exhibition_score} icon="展" note="展示上位艇の信頼性" />
        <ScoreCard label="風影響度" value={profile.wind_score} icon="風" note="風条件による変動幅" />
      </div>
      <div className={styles.aiComment}>
        <div className={styles.aiBadge}>AI</div>
        <div><small>DATA BOOK COMMENT</small><p>{profile.comment || createComment(stadium.name, yearly)}</p></div>
      </div>
      {profile.priority?.length > 0 && <div className={styles.priorityRow}><span>この場で重視する順番</span>{profile.priority.map((item, index) => <b key={`${item}-${index}`}><i>{index + 1}</i>{item}</b>)}</div>}
    </section>

    <section className={styles.panel}>
      <SectionHeading number="01" eyebrow="BASIC METRICS" title="直近1年の基本成績" />
      <div className={styles.primaryMetrics}>
        <StatCard label="1コース1着率" value={pct(yearly.course1_win_rate)} sub={`${Number(yearly.course1_win_count || 0).toLocaleString()}勝 / ${Number(payload?.race_count || 0).toLocaleString()}R`} score={yearly.course1_win_rate} />
        <StatCard label="イン逃げ率" value={pct(yearly.inside_escape_rate)} sub={`実進入判明 ${Number(yearly.inside_course_sample_count || 0).toLocaleString()}R`} score={yearly.inside_escape_rate} />
        <StatCard label="平均3連単" value={yen(yearly.avg_trifecta_payout)} sub={`払戻収録 ${Number(yearly.payout_sample_count || 0).toLocaleString()}R`} />
        <StatCard label="万舟率" value={pct(yearly.over10000_rate)} sub={`${Number(yearly.over10000_count || 0).toLocaleString()}R`} score={yearly.over10000_rate * 3.2} />
      </div>
      <div className={styles.coverageGrid}>
        <Coverage label="決まり手収録率" value={yearly.method_coverage_rate} />
        <Coverage label="払戻収録率" value={yearly.payout_coverage_rate} />
        <Coverage label="実進入収録率" value={payload?.race_count ? Number(yearly.inside_course_sample_count || 0) / Number(payload.race_count) * 100 : 0} />
      </div>
    </section>

    <section className={styles.panel}>
      <SectionHeading number="02" eyebrow="COURSE ANALYSIS" title="コース別1着率" />
      {payload?.course_stats?.length ? <div className={styles.courseChart}>{payload.course_stats.map(item => <CourseBar key={item.course} item={item} />)}</div> : <div className={styles.empty}>コース別データはData Engine v3実行後に表示されます。</div>}
    </section>

    <DataBookInteractive seasonalStats={payload?.seasonal_stats || []} windStats={payload?.wind_stats || []} trifectaStats={payload?.trifecta_stats || []} />

    {!premium ? <PremiumGate /> : <>
      <TodayRacePremium place={route.place} stadiumName={stadium.name} />
      <section className={styles.premiumPanel}>
        <SectionHeading number="06" eyebrow="PREMIUM / INSIDE" title="データによるイン逃げ攻略" premium />
        <StrategyBlock data={payload?.inside_strategy} fallback="条件別イン逃げ分析はData Engine v3で自動生成されます。" />
      </section>
      <section className={styles.premiumPanel}>
        <SectionHeading number="07" eyebrow="PREMIUM / UPSET" title="データによる穴攻略" premium />
        <StrategyBlock data={payload?.upset_strategy} fallback="差し・まくり・まくり差し別の穴条件を自動抽出します。" variant="reference" />
      </section>
      <section className={styles.premiumPanel}>
        <SectionHeading number="08" eyebrow="PREMIUM / EXHIBITION" title="展示情報の信頼度" premium />
        <Reliability data={payload?.exhibition_reliability} />
      </section>
      <section className={styles.summaryPanel}>
        <small>MONTHLY CONCLUSION</small><h2>今月の{stadium.name}攻略まとめ</h2>
        <div className={styles.summaryGrid}>
          <Summary label="最優先" value={profile.priority?.[0] || 'データ確認'} />
          <Summary label="イン評価" value={`${profile.inside_score || '—'}点`} />
          <Summary label="穴評価" value={`${profile.upset_score || '—'}点`} />
          <Summary label="攻略難易度" value={profile.difficulty_label || '分析中'} />
        </div>
        <p>{profile.premium_summary || profile.comment || createComment(stadium.name, yearly)}</p>
      </section>
    </>}

    <footer className={styles.footer}>過去データに基づく傾向であり、将来の結果を保証するものではありません。対象数・欠損率・更新日をご確認ください。{generatedAt && ` 最終生成: ${generatedAt}`}</footer>
  </main>;
}

function SectionHeading({ number, eyebrow, title, premium = false }) {
  return <div className={styles.sectionHeading}><div><span>{number}</span><small>{premium ? 'PREMIUM' : 'FREE DATA'}</small></div><div><p>{eyebrow}</p><h2>{title}</h2></div></div>;
}
function ScoreCard({ label, value, icon, note }) {
  const score = clamp(value);
  return <article className={styles.scoreCard}><div className={styles.scoreIcon}>{icon}</div><span>{label}</span><strong>{score || '—'}</strong><div className={styles.scoreTrack}><i style={{ width: `${score}%` }} /></div><small>{note}</small></article>;
}
function StatCard({ label, value, sub, score }) {
  const width = score == null ? 65 : clamp(score);
  return <article className={styles.statCard}><span>{label}</span><strong>{value}</strong><div className={styles.statTrack}><i style={{ width: `${width}%` }} /></div><small>{sub}</small></article>;
}
function Coverage({ label, value }) {
  const n = clamp(value);
  return <div className={styles.coverage}><span>{label}</span><b>{pct(value)}</b><div><i style={{ width: `${n}%` }} /></div></div>;
}
function CourseBar({ item }) {
  const n = clamp(item.win_rate);
  return <div className={styles.courseBar}><b className={`${styles.boat} ${styles[`boat${item.course}`]}`}>{item.course}</b><div><span><b>{item.course}コース</b><small>{Number(item.sample_count || 0).toLocaleString()}R</small></span><div className={styles.courseTrack}><i style={{ width: `${n}%` }} /></div></div><strong>{pct(item.win_rate)}</strong></div>;
}
function Stars({ value }) {
  const count = Math.max(1, Math.min(5, Math.round(Number(value || 0) / 20)));
  return <div className={styles.stars}>{'★'.repeat(count)}{'☆'.repeat(5 - count)}</div>;
}
function PremiumGate() {
  return <section className={styles.premiumGate}><small>BOATSTRIKERS PREMIUM</small><h2>ここから先は、データを「買い方」へ変える攻略エリア</h2><p>イン逃げ条件、穴パターン、展示信頼度、風攻略、AI総括を公開します。</p><div><span>イン攻略</span><span>穴攻略</span><span>展示攻略</span><span>風攻略</span></div><button type="button">24場攻略プレミアムを見る</button><small>管理者確認：URL末尾に ?preview=premium</small></section>;
}
function StrategyBlock({ data, fallback, variant = 'default' }) {
  if (!data || !Object.keys(data).length) return <div className={styles.empty}>{fallback}</div>;
  const sampleCount = Number(data.sample_count || 0);
  const badge = sampleLabel(sampleCount);
  const isReference = variant === 'reference' || sampleCount < 100;
  return <div className={`${styles.strategy} ${isReference ? styles.strategyReference : ''}`}>
    <div className={styles.grade}>
      <span>評価</span>
      <strong>{data.grade || '—'}</strong>
      <small>{sampleCount ? `${sampleCount.toLocaleString()}R` : ''}</small>
      {badge && <em className={styles.sampleBadge}>{badge}</em>}
    </div>
    <div className={styles.strategyBody}>
      <h3>{data.title || 'データ攻略'}</h3>
      <p>{data.description}</p>
      {data.conditions?.length > 0 && <ul>{data.conditions.map((item, index) => <li key={`${item}-${index}`}>✓ {item}</li>)}</ul>}
      <div className={styles.strategyMetrics}>
        <span><small>主要率</small><b>{pct(data.primary_rate)}</b></span>
        <span><small>対象数</small><b>{sampleCount.toLocaleString()}R</b></span>
      </div>
      {isReference && <p className={styles.sampleNote}>※ 対象数が少ないため参考値です。展示・風・万舟率など、ほかの条件と組み合わせて判断してください。</p>}
    </div>
  </div>;
}
function Reliability({ data }) {
  if (!data || !Object.keys(data).length) return <div className={styles.empty}>展示タイム・展示ST・周回展示の信頼度は集計後に表示されます。</div>;
  const metrics = data.metrics || [];
  const rankStats = data.rank_stats || [];
  const gapStats = data.gap_stats || [];
  const motorStats = data.motor_stats || [];
  const windStats = data.wind_stats || [];
  const scoreBreakdown = data.score_breakdown || [];
  return <div className={styles.exhibitionAi}>
    <div className={styles.exhibitionHero}>
      <div className={styles.exhibitionGradeBlock}><span>展示AI総合評価</span><strong>{data.grade || '—'}</strong><small>AI SCORE {data.ai_score ?? '—'} / 100</small></div>
      <p>{data.comment}</p>
      <div className={styles.exhibitionSamples}>
        <article><span>6艇展示収録</span><b>{Number(data.sample_count || 0).toLocaleString()}R</b></article>
        <article><span>展示1位判定</span><b>{Number(data.rank1_boat_count || 0).toLocaleString()}艇</b></article>
        <article><span>着順結合</span><b>{Number(data.finished_rank1_boat_count || 0).toLocaleString()}艇</b></article>
      </div>
    </div>

    {scoreBreakdown.length > 0 && <section className={styles.exhibitionSection}>
      <h3>展示AIスコア内訳</h3><p>順位・タイム差・モーター・風の4項目を重み付けして算出しています。</p>
      <div className={styles.aiBreakdown}>
        {scoreBreakdown.map((item, index) => <article key={`${item.label}-${index}`}>
          <div><strong>{item.label}</strong><small>配点 {item.weight}%</small></div>
          <b>{Number(item.score || 0)}<small>/100</small></b>
          <div className={styles.breakdownTrack}><i style={{ width: `${Math.max(0, Math.min(100, Number(item.score || 0)))}%` }} /></div>
          <p>{item.note}</p>
        </article>)}
      </div>
    </section>}

    <div className={styles.reliabilityGrid}>{metrics.map((item, index) => <article key={`${item.label}-${index}`}><span>{item.label}</span><strong>{item.value_text || pct(item.value)}</strong><small>{item.note}</small></article>)}</div>

    <ExhibitionTable title="展示順位別の成績" description="同タイムは同順位として集計しています。" rows={rankStats} firstLabel="展示順位" firstValue={row => `${row.rank}位`} highlightFirst />
    <ExhibitionTable title="展示タイム差の影響" description="展示1位艇を、次に速い異なるタイムとの差で分類しています。対象数が少ない帯は参考値です。" rows={gapStats} firstLabel="1位との差" firstValue={row => row.band} />
    <ExhibitionTable title="展示1位 × モーター" description="展示1位艇を、同一レース内のモーター2連率順位で比較します。" rows={motorStats} firstLabel="モーター条件" firstValue={row => row.band} />
    <ExhibitionTable title="展示1位 × 風" description="展示1位艇を風向・風速条件別に比較します。" rows={windStats} firstLabel="風条件" firstValue={row => `${windDisplay(row)} ${row.speed_band}`} limit={8} />
  </div>;
}
function ExhibitionTable({ title, description, rows, firstLabel, firstValue, highlightFirst = false, limit = 0 }) {
  if (!rows?.length) return <section className={styles.exhibitionSection}><h3>{title}</h3><p>{description}</p><div className={styles.empty}>対象データを集計中です。</div></section>;
  const shownRows = limit ? rows.slice(0, limit) : rows;
  return <section className={styles.exhibitionSection}>
    <h3>{title}</h3><p>{description}</p>
    <div className={styles.exhibitionTable}>
      <div className={styles.exhibitionTableHead}><b>{firstLabel}</b><b>対象</b><b>1着率</b><b>3連対率</b></div>
      {shownRows.map((row, index) => {
        const count = Number(row.sample_count || 0);
        const badge = sampleLabel(count);
        return <div className={`${styles.exhibitionTableRow} ${highlightFirst && index === 0 ? styles.highlightRow : ''}`} key={`${firstValue(row)}-${index}`}>
          <strong>{firstValue(row)}{badge && <em className={styles.inlineBadge}>{badge}</em>}</strong>
          <span>{count.toLocaleString()}</span><b>{pct(row.win_rate)}</b><b>{pct(row.top3_rate)}</b>
        </div>;
      })}
    </div>
    {limit > 0 && rows.length > limit && <p className={styles.tableFootnote}>上位{limit}条件を表示しています。全条件は集計データに保存されています。</p>}
  </section>;
}
function sampleLabel(count) {
  if (!Number.isFinite(Number(count))) return null;
  if (Number(count) < 50) return '少サンプル';
  if (Number(count) < 100) return '参考値';
  return null;
}
function windDisplay(row) {
  const map = {'01':'↓ 北','02':'↙ 北北東','03':'↙ 北東','04':'↙ 東北東','05':'← 東','06':'↖ 東南東','07':'↖ 南東','08':'↖ 南南東','09':'↑ 南','10':'↗ 南南西','11':'↗ 南西','12':'↗ 西南西','13':'→ 西','14':'↘ 西北西','15':'↘ 北西','16':'↘ 北北西'};
  const code = String(row.direction_code ?? '').padStart(2,'0');
  return map[code] || row.direction || (Number(row.wind_speed || 0) <= 1 ? 'ほぼ無風' : '風向判定なし');
}
function Summary({ label, value }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function buildFallbackProfile(yearly) {
  const inside = clamp((Number(yearly.course1_win_rate || 0) - 35) * 2.2);
  const upset = clamp(Number(yearly.over10000_rate || 0) * 3.4);
  return { overall_score: Math.round((inside + upset + 55 + 50) / 4), inside_score: inside, upset_score: upset, exhibition_score: 55, wind_score: 50, difficulty_label: '分析中', priority: ['展示', 'イン', '風'], comment: null };
}
function createComment(name, yearly) {
  const c1 = Number(yearly.course1_win_rate || 0);
  const high = Number(yearly.over10000_rate || 0);
  const insideText = c1 >= 55 ? '1コースの信頼度が比較的高い' : c1 >= 48 ? '1コースは標準的な強さ' : '1コースは慎重に見極めたい';
  const upsetText = high >= 20 ? '万舟も発生しやすく、穴条件の確認が重要です' : '配当は比較的落ち着きやすく、本命条件の精査が重要です';
  return `${name}は直近1年のデータでは${insideText}水面です。${upsetText}。表示されている母数と収録率を確認しながら、展示・風・進入を組み合わせて判断してください。`;
}
