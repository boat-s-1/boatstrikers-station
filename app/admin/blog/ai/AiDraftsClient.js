'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import s from '../blogAdmin.module.css';
import a from '../aiAdmin.module.css';

const jst = v => v ? new Date(v).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '—';
const STATUS = { candidate: '候補', drafted: '下書き作成済み', published: '公開済み', rejected: '不採用' };
const DRAFT = { needs_review: '確認待ち', approved: '承認済み', reapproval_needed: '要再承認（承認後に修正あり）', rejected: '却下' };
async function call(path, method = 'GET', body) {
  const res = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  let json; try { json = await res.json(); } catch { throw new Error('サーバーの応答を確認できません。'); }
  if (!res.ok) throw new Error(json.error || '処理に失敗しました。');
  return json;
}

export default function AiDraftsClient({ ready, writable, stadiums, categories, schedule }) {
  const [catalog, setCatalog] = useState({ registered: [], candidates: [] });
  const [category, setCategory] = useState('stadium-basics'), [stadium, setStadium] = useState('kiryu');
  const [sources, setSources] = useState({ urls: [], documents: [] }), [drafts, setDrafts] = useState([]), [runs, setRuns] = useState([]);
  const [form, setForm] = useState({ url: '', label: '', kind: 'official_site', registered_by: '' });
  const [busy, setBusy] = useState(''), [message, setMessage] = useState(''), [result, setResult] = useState(null);
  const perStadium = categories.find(c => c.slug === category)?.perStadium ?? true;
  const stadiumName = slug => stadiums.find(x => x.slug === slug)?.name || '';

  const loadTopics = useCallback(async () => {
    if (!ready) return;
    try { setCatalog(await call(`/api/admin/blog/ai/topics?category=${category}${perStadium ? `&stadium=${stadium}` : ''}`)); } catch (e) { setMessage(e.message); }
  }, [ready, category, stadium, perStadium]);
  const loadSources = useCallback(async () => {
    if (!ready) return;
    try { setSources(await call(`/api/admin/blog/ai/sources?stadium=${stadium}`)); } catch (e) { setMessage(e.message); }
  }, [ready, stadium]);
  const loadDrafts = useCallback(async () => {
    if (!ready) return;
    try { const r = await call('/api/admin/blog/ai/drafts'); setDrafts(r.drafts); setRuns(r.runs || []); } catch (e) { setMessage(e.message); }
  }, [ready]);
  useEffect(() => { loadTopics(); }, [loadTopics]);
  useEffect(() => { loadSources(); }, [loadSources]);
  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  async function run(label, fn) {
    if (busy) return; setBusy(label); setMessage('');
    try { await fn(); } catch (e) { setMessage(e.message); } finally { setBusy(''); }
  }
  const register = c => run('register', async () => { await call('/api/admin/blog/ai/topics', 'POST', { action: 'register', category_slug: c.category_slug, stadium_slug: c.stadium_slug, angle: c.angle }); await loadTopics(); });
  const rejectTopic = t => run('reject', async () => { await call('/api/admin/blog/ai/topics', 'POST', { action: 'reject', id: t.id, note: '管理画面で不採用' }); await loadTopics(); });
  const generate = t => run(`generate-${t.id}`, async () => {
    setResult(null);
    const r = await call('/api/admin/blog/ai/generate', 'POST', { topic_id: t.id });
    setResult(r); await Promise.all([loadTopics(), loadDrafts(), loadSources()]);
  });
  const fetchSources = () => run('fetch', async () => { const r = await call('/api/admin/blog/ai/sources', 'POST', { action: 'fetch', stadium_slug: stadium }); setMessage(`取得：成功 ${r.results.filter(x => x.ok).length}件・失敗 ${r.results.filter(x => !x.ok).length}件`); await loadSources(); });
  const addSource = e => { e.preventDefault(); run('add', async () => { await call('/api/admin/blog/ai/sources', 'POST', { action: 'register', stadium_slug: stadium, ...form }); setForm(f => ({ ...f, url: '', label: '' })); await loadSources(); }); };
  const open = catalog.registered.filter(t => t.status === 'candidate');

  return <>
    {message ? <p role="alert" className={s.notice}>{message}</p> : null}
    <section className={s.panel}><div className={s.panelHeading}><h2>1. テーマを選ぶ</h2></div>
      <div className={a.form}>
        <label>カテゴリー<select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
        {perStadium ? <label>場<select value={stadium} onChange={e => setStadium(e.target.value)}>{stadiums.map(x => <option key={x.slug} value={x.slug}>{x.name}</option>)}</select></label> : null}
      </div>
      <h3 className={a.meta}>未登録のテーマ候補（登録済み・同じテーマは表示しません）</h3>
      <div className={a.rows}>{catalog.candidates.length ? catalog.candidates.map(c => <div className={a.row} key={c.topic_key}><span><strong>{c.title_hint}</strong><br /><span className={a.small}>{c.topic_key}</span></span>
        <button className={s.button} disabled={!writable || !!busy} onClick={() => register(c)}>テーマに登録</button></div>) : <p className={a.small}>候補はありません。</p>}</div>
      <h3 className={a.meta}>下書き作成を待っているテーマ</h3>
      <div className={a.rows}>{open.length ? open.map(t => <div className={a.row} key={t.id}><span><strong>{t.title_hint}</strong><br /><span className={a.small}>{t.topic_key}</span></span>
        <span className={a.rowActions}><button className={s.primary} disabled={!writable || !!busy} onClick={() => generate(t)}>{busy === `generate-${t.id}` ? '作成中…（1〜3分）' : 'AIで下書きを作成'}</button>
          <button className={s.button} disabled={!writable || !!busy} onClick={() => rejectTopic(t)}>不採用</button></span></div>) : <p className={a.small}>登録済みのテーマはありません。</p>}</div>
      {result ? <div className={s.notice}>下書きを作成しました：/{result.slug}（要修正 {result.blocking}件・確認 {result.warnings}件）。<Link href={`/admin/blog/posts/${result.post_id}`}>記事編集で確認する →</Link></div> : null}
    </section>

    <section className={s.panel}><div className={s.panelHeading}><h2>2. 公式情報（{stadiumName(stadium)}）</h2><button className={s.button} disabled={!writable || !!busy} onClick={fetchSources}>{busy === 'fetch' ? '取得中…' : '公式情報を取得'}</button></div>
      <p className={a.meta}>BOAT RACE公式の場データは自動で対象になります。各場の公式サイトなどは、URLを登録すると取得できます。取得できないページは、内容を確認できるページのURLを登録し直してください。取得元と取得日時はすべて記録されます。</p>
      <div className={a.rows}>{sources.urls.map(u => <div className={a.row} key={u.url}><span><strong>{u.label}</strong>（{u.kind === 'official_data' ? 'BOAT RACE公式' : u.kind === 'official_site' ? '場の公式サイト' : '手動登録'}{u.pending ? '・初回取得時に登録' : ''}）<br /><span className={a.small}>{u.url}</span></span></div>)}</div>
      <form className={a.form} onSubmit={addSource} style={{ marginTop: 14 }}>
        <label>URL（https）<input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} inputMode="url" /></label>
        <label>出典名<input value={form.label} maxLength={200} onChange={e => setForm({ ...form, label: e.target.value })} /></label>
        <label>種類<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option value="official_site">場の公式サイト</option><option value="manual">その他（手動登録）</option></select></label>
        <label>登録者名<input value={form.registered_by} maxLength={80} onChange={e => setForm({ ...form, registered_by: e.target.value })} /></label>
        <button className={s.button} disabled={!writable || !!busy || !form.url || !form.label || !form.registered_by}>URLを登録</button>
      </form>
      <h3 className={a.meta}>取得履歴（新しい順）</h3>
      <div className={a.rows}>{sources.documents.length ? sources.documents.map(d => <div className={a.row} key={d.id}><span>{d.fetch_error ? <span className={`${a.tag} ${a.tagBad}`}>失敗</span> : <span className={a.tag}>取得済み</span>} {d.title || d.url}<br /><span className={a.small}>{jst(d.fetched_at)}・{d.fetch_error || `SHA-256 ${d.content_sha256?.slice(0, 12)}…`}</span></span></div>) : <p className={a.small}>まだ取得していません。</p>}</div>
    </section>

    <section className={s.panel}><div className={s.panelHeading}><h2>3. AI下書き（確認と承認）</h2><span>{drafts.length}件</span></div>
      <ol className={a.steps}><li>記事編集画面で本文・出典・表紙を確認し、必要なら修正します。</li><li>「AI下書きの確認」で承認者名を入力し、その版を承認します（要修正が残っていると承認できません）。</li><li>承認後、「公開設定」から公開・予約します。承認後に修正した場合は再承認が必要です。</li></ol>
      <div className={a.rows}>{drafts.length ? drafts.map(d => <div className={a.row} key={d.post_id}><span><span className={`${a.tag} ${(d.approval_state ?? d.status) === 'approved' ? '' : d.status === 'rejected' ? a.tagBad : a.tagWarn}`}>{DRAFT[d.approval_state ?? d.status]}</span> 要修正 {d.blocking_issues}件（版{d.validated_version ?? '-'}の確認時）<br /><span className={a.small}>作成 {jst(d.generated_at)}・{d.model}</span></span>
        <span className={a.rowActions}><Link className={s.button} href={`/admin/blog/posts/${d.post_id}`}>確認・編集</Link><Link className={s.button} href={`/admin/blog/posts/${d.post_id}/preview`}>プレビュー</Link></span></div>) : <p className={a.small}>AI下書きはまだありません。</p>}</div>
    </section>
    <section className={s.panel}><div className={s.panelHeading}><h2>4. 定時の自動作成</h2><span className={`${a.tag} ${schedule.enabled ? '' : a.tagWarn}`}>{schedule.enabled ? '有効' : '無効'}</span></div>
      <p className={a.meta}>{schedule.enabled ? `1回あたり最大${schedule.maxPerRun}件、登録済みのテーマから下書きを作ります${schedule.autoTopics ? `（テーマが無いときは ${schedule.categories.map(c => categories.find(x => x.slug === c)?.name || c).join('・')} から自動で選びます）` : ''}。公開はしません。` : '現在は無効です。有効にするには、環境変数と定時実行の設定が必要です（手順書を参照）。下書きの自動作成だけで、公開は常に人の承認が必要です。'}</p>
      <h3 className={a.meta}>最近の作成履歴（7日間）</h3>
      <div className={a.rows}>{runs.length ? runs.map(r => <div className={a.row} key={r.id}><span><span className={`${a.tag} ${r.status === 'failed' ? a.tagBad : r.status === 'succeeded' ? '' : a.tagWarn}`}>{{ succeeded: '成功', failed: '失敗', running: '実行中', skipped: '見送り' }[r.status]}</span> {r.trigger === 'schedule' ? '定時' : '手動'}・{jst(r.started_at)}<br /><span className={a.small}>{r.message || ''}</span></span>
        {r.post_id ? <Link className={s.button} href={`/admin/blog/posts/${r.post_id}`}>下書きを開く</Link> : null}</div>) : <p className={a.small}>履歴はありません。</p>}</div>
    </section>
    <p className={s.footnote}>テーマの状態：{Object.entries(STATUS).map(([k, v]) => `${v} ${catalog.registered.filter(t => t.status === k).length}件`).join('・')}</p>
  </>;
}
