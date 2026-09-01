import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { buildCollectionStatus, normalizeCollectionDate } from '../../../../lib/exhibitionCollectionStatus';
import CollectionRefresh from './CollectionRefresh';
import SyncHealth, { AcquisitionStatus } from './SyncHealth';
import { summarizeVenueAttempts } from '../../../../lib/exhibitionSyncHealth';
import styles from '../alerts.module.css';

export const dynamic = 'force-dynamic';

function jstTime(value) {
  return new Date(value).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
}

async function loadCollection(date) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('collection_configuration_missing');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const fields = 'race_date,course_code,race_no,boat_no,gender_code,official_exhibition_time,exhibition_time,official_lap,official_turn,official_straight,official_half_lap,lap_time,turn_time,straight_time,half_lap_time,official_exhibition_source,official_exhibition_synced_at,exhibition_source,exhibition_synced_at,data_source,exhibition_field_meta';
  // Explicit paging: a full 24-venue day has 1,728 boats, exceeding the default 1,000-row API limit.
  const safeRead = query => Promise.resolve(query).catch(() => ({ error: true, data: null }));
  const [events, first, second, runtime, attempts] = await Promise.all([
    client.from('bs_race_events').select('race_date,course_code,race_no').eq('race_date', date).limit(288),
    client.from('bs_race_entries').select(fields).eq('race_date', date).order('course_code').order('race_no').order('boat_no').range(0, 899),
    client.from('bs_race_entries').select(fields).eq('race_date', date).order('course_code').order('race_no').order('boat_no').range(900, 1799),
    safeRead(client.from('bs_sync_runtime').select('state,heartbeat_at,last_success_at,last_status,last_summary').eq('id', 1).maybeSingle()),
    // At most 24 venues * 12 races * 3 consumers = 864 latest-result rows per date.
    safeRead(client.from('bs_exhibition_acquisition_status').select('race_date,course_code,race_no,consumer,started_at,checked_at,reason_code,source_kind,source_results,last_success_at,last_failure_at,last_failure_code').eq('race_date', date).order('course_code').order('race_no').order('consumer').limit(900)),
  ]);
  return {
    rows: events.error || first.error || second.error ? null : buildCollectionStatus({ date, events: events.data || [], entries: [...(first.data || []), ...(second.data || [])] }),
    runtime: runtime.data, runtimeError: Boolean(runtime.error), attempts: attempts.data || [], attemptsError: Boolean(attempts.error),
  };
}

export default async function CollectionPage({ searchParams }) {
  const query = await searchParams;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const date = normalizeCollectionDate(query?.date, today);
  let collection = { rows: null, runtime: null, runtimeError: true, attempts: [], attemptsError: true };
  try { collection = await loadCollection(date); } catch { console.error('exhibition_collection_read_failed'); }
  const { rows } = collection;
  const checkedAt = new Date().toISOString();
  return <main className={styles.page}><div className={styles.shell}>
    <Link className={styles.back} href="/admin/alerts">← アラート管理に戻る</Link>
    <header className={styles.hero}><span>ORIGINAL EXHIBITION / COLLECTION</span><h1>24場のオリ展収集状況</h1><p>出走表・通知処理が参照する保存済み展示データを確認できます。</p></header>
    <div className={styles.controls}>
      <form action="/admin/alerts/collection" className={styles.controls} style={{ margin: 0 }}>
        <label>開催日（日本時間）<input key={date} type="date" name="date" defaultValue={date} required /></label>
        <button className={styles.button} type="submit">表示</button>
      </form>
      <CollectionRefresh />
      <Link href="/admin/alerts/exhibition">取得元の接続状況・個別診断 →</Link>
    </div>
    <p>画面読込：{jstTime(checkedAt)} JST · 表示中は30秒ごとに保存データを再読込</p>
    <SyncHealth runtime={collection.runtime} error={collection.runtimeError} date={date} />
    <div className={styles.notice}>「更新済R」は、一周・まわり足・直線・半周のいずれか同じ項目が1〜6号艇すべて揃ったレースです。通常の展示タイムだけでは数えません。<br />更新時間はオリ展の最終保存同期時刻（一部取得を含む）で、公式の公開時刻・初回取得時刻ではありません。画面の再読込だけでは変わりません。半周と一周は別項目として扱います。</div>
    {!rows ? <p role="alert" className={styles.notice}>保存データを読み込めませんでした。「未取得」とは判定していません。再読込してください。</p> : <>
      <div className={styles.summary}><span>更新あり <strong>{rows.filter(row => row.completed.length).length}場</strong></span><span>更新済み <strong>{rows.reduce((sum, row) => sum + row.completed.length, 0)}R</strong></span></div>
      <div className={styles.tableWrap} style={{ marginTop: 20 }}><table className={styles.table} style={{ minWidth: 640 }}>
        <caption>{date} / 全24場 · 日本時間</caption>
        <thead><tr><th scope="col">場</th><th scope="col">オリ展更新時間</th><th scope="col">更新済R</th><th scope="col">収集元</th><th scope="col">取得処理の確認結果</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.code}>
          <th scope="row">{String(row.code).padStart(2, '0')} {row.name}</th>
          <td>{row.latest ? <time dateTime={row.latest} title={new Date(row.latest).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}>{jstTime(row.latest)}</time> : row.sources.length ? '時刻不明' : '—'}</td>
          <td>{row.completed.length ? <><strong>{row.completed.at(-1).race}R</strong><small>更新済：{row.completed.map(race => `${race.race}R`).join('・')}</small><details><summary>揃った項目・通知判定接続</summary>{row.completed.map(race => <small key={race.race}><Link href={`/races/${String(row.code).padStart(2, '0')}/${race.race}?date=${date}`}>{race.race}R</Link>：{race.metrics.join('・')}<br />判定可能：{[['kiina','キイナ'],['ichika','一果'],['hatsune','初音']].filter(([key])=>race.theories[key]).map(([,label])=>label).join('・')||'なし'}</small>)}</details></> : row.state}
            {row.partial.length > 0 && <small>一部取得・要確認：{row.partial.map(race => `${race}R`).join('・')}</small>}
          </td>
          <td>{row.sources.length ? row.sources.join(' / ') : '—'}</td>
          <td><AcquisitionStatus summary={summarizeVenueAttempts(collection.attempts, date, row.code)} readError={collection.attemptsError} /></td>
        </tr>)}</tbody>
      </table></div>
      <p className={styles.notice}>「未取得」は保存値がない状態です。展示待ち・取得失敗・対象項目なしのどれかは、この表だけでは断定しません。「開催登録なし」は開催テーブルに登録がない状態です。更新済みでも全項目取得・理論成立・LINE送信済みを意味しません。この画面は読み取り専用です。</p>
      <p className={styles.notice}>取得記録は今回の追加以降、3理論の自動収集で確認したレースだけに残ります。締切前の収集対象時間外・記録開始前の未取得理由は分かりません。取得成功は保存完了を保証しません。保存値は「更新済R」で確認してください。個別の読み取り専用診断は記録対象外です。</p>
    </>}
  </div></main>;
}
