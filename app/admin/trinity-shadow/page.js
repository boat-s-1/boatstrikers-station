import { createClient } from '@supabase/supabase-js';
import { isAdminAuthenticated } from '../sync/_lib/adminAuth';
import { summarizeShadow } from '../../lib/trinityShadowMetrics';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'TRINITY SHADOW | 管理画面', robots: { index: false } };
const dateJst = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo',
  year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const yen = value => `${Number(value || 0).toLocaleString('ja-JP')}円`;
const percent = value => value == null ? '集計待ち' : `${value.toFixed(2)}%`;
const header = { padding: 10, textAlign: 'left', borderBottom: '1px solid #aaa' };
const cell = { padding: 10, borderBottom: '1px solid #ddd', verticalAlign: 'top' };

export default async function TrinityShadowPage() {
  if (!await isAdminAuthenticated()) return null;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
  const rows = [];
  let error = null;
  for (let offset = 0; ; offset += 500) {
    const page = await db.from('trinity_prediction_snapshots')
      .select('prediction_id,generated_at,race_date,course_code,race_no,timing,engine_version,strategy_tag,recommendation,ticket_count,investment_yen,trinity_prediction_results(hit,payout_yen)')
      .order('generated_at', { ascending: false }).order('prediction_id', { ascending: false })
      .range(offset, offset + 499);
    if (page.error) { error = page.error; break; }
    rows.push(...page.data);
    if (page.data.length < 500) break;
  }
  const detail = await db.from('trinity_prediction_snapshots')
    .select('*,trinity_prediction_results(*)').order('generated_at', { ascending: false }).limit(20);
  if (detail.error) error = detail.error;
  const today = dateJst();
  const by = (version, timing) => rows.filter(r => r.engine_version === version && r.timing === timing);
  const versions = ['trinity-core-v2', 'trinity-v3-candidate-01'];
  const timings = ['previous_day', 'after_exhibition'];
  const todayRows = rows.filter(r => r.race_date === today);
  const summary = versions.flatMap(version => timings.map(timing => ({ version, timing,
    metrics: summarizeShadow(by(version, timing)) })));
  const n = tag => todayRows.filter(r => r.engine_version === versions[1] && r.strategy_tag === tag).length;
  const dates = [...new Set(rows.map(r => r.race_date))].sort();
  const start = dates[0];
  const days = start ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) : 0;
  return <main style={{ maxWidth: 1200, margin: '65px auto 120px', padding: 24, color: '#111827', background: '#fff' }}>
    <h1>TRINITY SHADOW</h1>
    <p>公開予想・購入には使用しません。V3 candidate-01 の条件は固定。ROIは結果確定済みの購入レースだけで集計します。</p>
    {error && <p role="alert">取得エラー: {error.message}</p>}
    <h2>今日 {today}（前日版・直前版）</h2>
    <p>対象レース {todayRows.filter(r => r.engine_version === versions[0]).length} ／ V2 BUY {todayRows.filter(r => r.engine_version === versions[0] && r.recommendation === 'BUY').length} ／ V3 BUY {todayRows.filter(r => r.engine_version === versions[1] && r.recommendation === 'BUY').length}</p>
    <p>一果型 {n('ichika_selective')} ／ 初音型 {n('hatsune_watch')} ／ キイナ型 {n('kiina_watch')}</p>
    <h2>モデル比較（予想時点別・累計）</h2>
    <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', minWidth: 900 }}>
      <thead><tr>{['モデル','時点','対象/結果確定','BUY/PASS率','ROI','的中率','平均点数','投資','払戻','収支','最大連敗','上位1/3/5件除外ROI'].map(x => <th key={x} style={header}>{x}</th>)}</tr></thead>
      <tbody>{summary.map(({ version, timing, metrics: m }) => <tr key={`${version}-${timing}`}>
        <td style={cell}>{version}</td><td style={cell}>{timing}</td><td style={cell}>{m.races} / {m.settled_races}</td>
        <td style={cell}>{m.bought_races} / {percent(m.pass_rate)}</td><td style={cell}>{percent(m.roi)}</td>
        <td style={cell}>{percent(m.hit_rate)}</td><td style={cell}>{m.avg_tickets?.toFixed(2) ?? '—'}</td>
        <td style={cell}>{yen(m.investment)}</td><td style={cell}>{yen(m.payout)}</td><td style={cell}>{yen(m.profit)}</td>
        <td style={cell}>{m.max_losing_streak}</td><td style={cell}>{[m.top1_excluded_roi,m.top3_excluded_roi,m.top5_excluded_roi].map(percent).join(' / ')}</td>
      </tr>)}</tbody>
    </table></div>
    <p>未来スナップショット開始から {days} 日。7日速報 {days >= 7 ? '集計可能' : '蓄積中'} ／ 30日正式評価 {days >= 30 ? '集計可能' : '蓄積中'} ／ 60日採用検討 {days >= 60 ? '集計可能' : '蓄積中'}。購入300レース未満のV3は採用判定しません。</p>
    <h2>日次比較</h2>
    <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', minWidth: 600 }}>
      <thead><tr>{['日付','モデル','時点','対象','購入','確定','的中','ROI','上位1件除外'].map(x => <th key={x} style={header}>{x}</th>)}</tr></thead>
      <tbody>{dates.slice(-30).reverse().flatMap(date => versions.flatMap(version => timings.map(timing => {
        const m = summarizeShadow(by(version, timing).filter(r => r.race_date === date));
        return <tr key={`${date}-${version}-${timing}`}><td style={cell}>{date}</td><td style={cell}>{version}</td><td style={cell}>{timing}</td>
          <td style={cell}>{m.races}</td><td style={cell}>{m.bought_races}</td>
          <td style={cell}>{m.settled_races}</td><td style={cell}>{m.hits}</td>
          <td style={cell}>{percent(m.roi)}</td><td style={cell}>{percent(m.top1_excluded_roi)}</td></tr>;
      })))}</tbody>
    </table></div>
    <h2>一果・初音・キイナ（V3 前日版）</h2>
    <ul>{['ichika_selective','hatsune_watch','kiina_watch'].map(tag => { const m = summarizeShadow(by(versions[1], 'previous_day').filter(r => r.strategy_tag === tag)); return <li key={tag}>{tag}: 対象 {m.races} / BUY {m.bought_races} / 的中 {m.hits} / ROI {percent(m.roi)} / 平均 {m.avg_tickets?.toFixed(2) ?? '—'} 点</li>; })}</ul>
    <h2>直前版（結果確定のみROI）</h2>
    <p>{versions.map(v => { const m = summarizeShadow(by(v,'after_exhibition')); return `${v}: ${m.races}レース、BUY ${m.bought_races}、ROI ${percent(m.roi)}`; }).join(' ／ ')}</p>
    <h2>予想の詳細（最新20件）</h2>
    {(detail.data || []).map(r => <details key={r.prediction_id} style={{ padding: 12, borderBottom: '1px solid #ddd' }}>
      <summary>{r.race_date} {r.course_code}場 {r.race_no}R {r.timing} {r.engine_version} {r.recommendation} / {r.strategy_tag}</summary>
      <p>生成: {r.generated_at} ／ 入力取得: {r.source_captured_at} ／ 使用オッズ: {r.odds_captured_at || 'なし'}</p>
      <p>首位 {r.top_combination} / 確率 {percent(r.top_combination_probability == null ? null : 100 * r.top_combination_probability)} / 点数 {r.ticket_count} / 投資 {yen(r.investment_yen)}</p>
      <p>結果: {r.trinity_prediction_results ? `${r.trinity_prediction_results.actual_trifecta} / 払戻 ${yen(r.trinity_prediction_results.payout_yen)}` : '未確定'}</p>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify({ input: r.boat_features, ichika: r.ichika_scores, hatsune: r.hatsune_scores, kiina: r.kiina_scores, trinity: r.trinity_scores, first: r.first_probabilities, second: r.second_probabilities, third: r.third_probabilities, tickets: r.selected_tickets, odds_snapshot_id: r.odds_snapshot_id, market_implied_probability: r.market_implied_probability, edge: r.edge, expected_value: r.expected_value }, null, 2)}</pre>
    </details>)}
  </main>;
}
