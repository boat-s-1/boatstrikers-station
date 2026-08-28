import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { buildCollectionStatus, normalizeCollectionDate } from '../../../../lib/exhibitionCollectionStatus';
import CollectionRefresh from './CollectionRefresh';
import styles from '../alerts.module.css';

export const dynamic = 'force-dynamic';

function jstTime(value) {
  return new Date(value).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
}

async function loadCollection(date) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('collection_configuration_missing');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const fields = 'race_date,course_code,race_no,boat_no,official_lap,official_turn,official_straight,official_half_lap,lap_time,turn_time,straight_time,half_lap_time,official_exhibition_source,official_exhibition_synced_at,exhibition_source,exhibition_synced_at,data_source';
  // Explicit paging: a full 24-venue day has 1,728 boats, exceeding the default 1,000-row API limit.
  const [events, first, second] = await Promise.all([
    client.from('bs_race_events').select('race_date,course_code,race_no').eq('race_date', date).limit(288),
    client.from('bs_race_entries').select(fields).eq('race_date', date).order('course_code').order('race_no').order('boat_no').range(0, 899),
    client.from('bs_race_entries').select(fields).eq('race_date', date).order('course_code').order('race_no').order('boat_no').range(900, 1799),
  ]);
  if (events.error || first.error || second.error) throw new Error('collection_read_failed');
  return buildCollectionStatus({ date, events: events.data || [], entries: [...(first.data || []), ...(second.data || [])] });
}

export default async function CollectionPage({ searchParams }) {
  const query = await searchParams;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const date = normalizeCollectionDate(query?.date, today);
  let rows = null;
  try { rows = await loadCollection(date); } catch (error) { console.error('exhibition collection status:', error.message); }
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
    <div className={styles.notice}>「更新済R」は、一周・まわり足・直線・半周のいずれか同じ項目が1〜6号艇すべて揃ったレースです。通常の展示タイムだけでは数えません。<br />更新時間はオリ展の最終保存同期時刻（一部取得を含む）で、公式の公開時刻・初回取得時刻ではありません。画面の再読込だけでは変わりません。半周と一周は別項目として扱います。</div>
    {!rows ? <p role="alert" className={styles.notice}>保存データを読み込めませんでした。「未取得」とは判定していません。再読込してください。</p> : <>
      <div className={styles.summary}><span>更新あり <strong>{rows.filter(row => row.completed.length).length}場</strong></span><span>更新済み <strong>{rows.reduce((sum, row) => sum + row.completed.length, 0)}R</strong></span></div>
      <div className={styles.tableWrap} style={{ marginTop: 20 }}><table className={styles.table} style={{ minWidth: 640 }}>
        <caption>{date} / 全24場 · 日本時間</caption>
        <thead><tr><th scope="col">場</th><th scope="col">オリ展更新時間</th><th scope="col">更新済R</th><th scope="col">収集元</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.code}>
          <th scope="row">{String(row.code).padStart(2, '0')} {row.name}</th>
          <td>{row.latest ? <time dateTime={row.latest} title={new Date(row.latest).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}>{jstTime(row.latest)}</time> : row.sources.length ? '時刻不明' : '—'}</td>
          <td>{row.completed.length ? <><strong>{row.completed.at(-1).race}R</strong><small>更新済：{row.completed.map(race => `${race.race}R`).join('・')}</small><details><summary>揃った項目</summary>{row.completed.map(race => <small key={race.race}><Link href={`/races/${String(row.code).padStart(2, '0')}/${race.race}?date=${date}`}>{race.race}R</Link>：{race.metrics.join('・')}</small>)}</details></> : row.state}
            {row.partial.length > 0 && <small>一部取得・要確認：{row.partial.map(race => `${race}R`).join('・')}</small>}
          </td>
          <td>{row.sources.length ? row.sources.join(' / ') : '—'}</td>
        </tr>)}</tbody>
      </table></div>
      <p className={styles.notice}>「未取得」は保存値がない状態です。展示待ち・取得失敗・対象項目なしのどれかは、この表だけでは断定しません。「開催登録なし」は開催テーブルに登録がない状態です。更新済みでも全項目取得・理論成立・LINE送信済みを意味しません。この画面は読み取り専用です。</p>
    </>}
  </div></main>;
}
