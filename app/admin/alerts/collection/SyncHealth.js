import Link from 'next/link';
import { HEARTBEAT_STALE_MINUTES, summarizePcSync, WORKER_LABELS, EXHIBITION_LABELS } from '../../../../lib/exhibitionSyncHealth';
import { REASON_LABELS } from '../../../../lib/exhibitionAcquisitionTelemetry';
import styles from '../alerts.module.css';

export function formatHealthTime(value) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }) : '不明';
}
const numberText = value => value === null ? '不明' : `${value}件`;
export default function SyncHealth({ runtime, error, date }) {
  const health = summarizePcSync(runtime, date);
  return <section aria-labelledby="sync-health-title" className={styles.notice}>
    <h2 id="sync-health-title">PC-KYOTEIの同期状態</h2>
    {error ? <p role="alert">同期ログを読み込めませんでした。停止・データ0件とは判定していません。</p> : <>
      <div className={styles.summary}>
        <span>同期プログラム：<strong>{WORKER_LABELS[health.worker]}</strong></span>
        <span>展示処理：<strong>{EXHIBITION_LABELS[health.exhibition]}</strong></span>
      </div>
      <p>最終応答：{formatHealthTime(health.heartbeat)} JST{health.ageMinutes !== null ? `（${health.ageMinutes}分前）` : ''}<br />
        展示の確認対象日：{health.targetDate || '不明'} ／ 確認時刻：{formatHealthTime(health.checkedAt)} JST<br />
        選択日 {date} の入力：{numberText(health.sourceRows)} ／ 有効値：{numberText(health.validRows)}</p>
      <details><summary>PC-KYOTEI入力テーブルの確認結果</summary>
        {health.inputs.map(input => <p key={input.key}>{input.key.toUpperCase()}：最新データ日 {input.latestDate || '不明'} ／ 選択日データ {numberText(input.rows)}</p>)}
      </details>
    </>}
    <p>応答が{HEARTBEAT_STALE_MINUTES}分以上更新されない場合は「停止の疑い」と表示します。夜間停止・長時間処理でも表示されるため、PC-KYOTEI本体の停止を断定するものではありません。全体の同期成功と、展示データの取得成功は別です。件数は直近の展示処理の結果で、全場の累計ではありません。</p>
    <Link href="/admin/sync">同期管理を確認 →</Link>
  </section>;
}

const SOURCE_LABELS = { boaters: 'BOATERS', tsu: '津公式', amagasaki: '尼崎公式', official: '公式', verifiedOfficial: '公式（照合付き）' };
const CONSUMERS = { kiina: 'キイナ', ichika: '一果', hatsune: '初音' };
export function AcquisitionStatus({ summary, readError }) {
  if (readError) return <small>取得記録の読込失敗（未取得とは別）</small>;
  if (!summary?.latest) return <small>取得記録なし<br />記録開始前・収集対象時間外の可能性あり</small>;
  const latest = summary.latest;
  return <>
    <strong>{latest.race_no}R：{REASON_LABELS[latest.reason_code] || REASON_LABELS.unknown}</strong>
    <small>確認：{formatHealthTime(latest.checked_at)} JST</small>
    <details><summary>レース別の最新結果・直近失敗</summary>
      {summary.races.map(result => <div key={result.race_no}>
        <small><strong>{result.race_no}R · {CONSUMERS[result.consumer] || '不明'}</strong>：{REASON_LABELS[result.reason_code] || REASON_LABELS.unknown}<br />{formatHealthTime(result.checked_at)} JST</small>
        {Array.isArray(result.source_results) && result.source_results.filter(source => SOURCE_LABELS[source.key]).map(source => <small key={source.key}>{SOURCE_LABELS[source.key]}：{REASON_LABELS[source.code] || REASON_LABELS.unknown}{Number.isInteger(source.http) ? `（HTTP ${source.http}）` : ''}</small>)}
        {result.last_failure_at && <small>この処理の直近取得不可：{formatHealthTime(result.last_failure_at)} ／ {REASON_LABELS[result.last_failure_code] || REASON_LABELS.unknown}{result.reason_code === 'ready' ? ' → 再取得成功' : ''}</small>}
      </div>)}
    </details>
  </>;
}
