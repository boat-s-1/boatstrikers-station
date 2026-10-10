'use client';
import { useCallback, useEffect, useState } from 'react';
import s from './blogAdmin.module.css';
import a from './aiAdmin.module.css';

const jst = v => v ? new Date(v).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '';
async function call(path, method = 'GET', body) {
  const res = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  let json; try { json = await res.json(); } catch { throw new Error('サーバーの応答を確認できません。'); }
  if (!res.ok) throw new Error(json.error || '処理に失敗しました。');
  return json;
}

// Shown in the editor for AI-generated posts. Approval is tied to the saved version on screen;
// the database refuses publication if the approved version is not the current one.
export default function AiReviewPanel({ postId, autosave, writable, onStatus }) {
  const [status, setStatus] = useState(null), [name, setName] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [fact, setFact] = useState({ statement: '', source_label: '', source_url: '', checked_at: '', registered_by: '' });
  const load = useCallback(async () => {
    try { const result = await call(`/api/admin/blog/ai/drafts/${postId}`); setStatus(result); onStatus?.(result); }
    catch { setStatus({ error: true }); onStatus?.(null); }
  }, [postId, onStatus]);
  useEffect(() => { load(); }, [load, autosave.version]);
  if (!status) return null;
  if (status.error) return <p className={s.notice}>AI下書きの情報を確認できませんでした（AI生成の記事は、承認がないと公開できません）。</p>;
  if (!status.ai) return null;
  const current = status.approved_current && status.version === autosave.version && !autosave.dirty;
  const issues = [...(status.validation || [])].sort((x, y) => (x.level === 'blocking' ? 0 : 1) - (y.level === 'blocking' ? 0 : 1));
  // The server re-checks the saved version on every load; unsaved edits are checked once autosave stores them.
  const stale = status.checked_version !== autosave.version || autosave.dirty;
  async function approve() {
    if (busy) return; setBusy(true); setMessage('');
    try {
      const saved = await autosave.saveNow();
      if (saved.dirty || saved.status !== 'saved') throw new Error('保存できていない変更があります。保存してから承認してください。');
      const result = await call(`/api/admin/blog/ai/drafts/${postId}/approve`, 'POST', { version: saved.version, approver_name: name });
      setMessage(result.approved ? 'この版を承認しました。「公開設定」から公開・予約できます。' : '要修正の項目があるため承認できません。下の一覧を確認してください。');
      await load();
    } catch (e) { setMessage(e.message); } finally { setBusy(false); }
  }
  async function addSource(e) {
    e.preventDefault(); if (busy) return; setBusy(true); setMessage('');
    try {
      const saved = await autosave.saveNow();
      if (saved.dirty || saved.status !== 'saved') throw new Error('保存できていない変更があります。保存してから登録してください。');
      await call(`/api/admin/blog/ai/drafts/${postId}/sources`, 'POST', { version: saved.version, ...fact, checked_at: fact.checked_at ? new Date(fact.checked_at).toISOString() : '' });
      window.location.reload();
    } catch (err) { setMessage(err.message); setBusy(false); }
  }
  return <section className={a.review} aria-label="AI下書きの確認">
    <div className={a.reviewHead}><h2>AI下書きの確認</h2>
      {current ? <span className={a.tag}>承認済み（この版）</span> : status.status === 'rejected' ? <span className={`${a.tag} ${a.tagBad}`}>却下</span> : <span className={`${a.tag} ${a.tagWarn}`}>未承認</span>}</div>
    {status.comparison ? <p role="note" className={s.notice}><strong>比較用の下書きです。</strong>元記事 /{status.comparison.of_slug}（{status.comparison.of_prompt_version ?? '版不明'}）と比べるために、{status.comparison.prompt_version}で作成しました。この下書きは承認・公開・予約公開できません（正式に採用するには、別途の採用操作が必要です）。</p> : null}
    <p className={a.meta}>AIが作成した下書きです（{status.model}・{jst(status.generated_at)}）。事実・数値・出典を確認し、問題がなければこの版を承認してください。承認後に本文を修正すると、再承認が必要になります。
      {status.approval ? <><br />最終承認：{status.approval.name}（{jst(status.approval.at)}・版{status.approval.version}）</> : null}</p>
    {issues.length ? <><p className={a.meta}>{stale ? '※ 未保存の変更があります。保存すると、現在の内容で確認し直します。' : `確認結果（保存済みの版${status.checked_version}）`}</p>
      <ul className={a.issues}>{issues.map((i, n) => <li key={n} data-level={i.level}>{i.level === 'blocking' ? '要修正：' : '確認：'}{i.origin === 'generation' ? '（作成時）' : ''}{i.message}</li>)}</ul></> : <p className={a.meta}>自動確認で指摘はありません。</p>}
    {status.scorecard ? <details><summary className={a.meta}>記事品質の目安（参考）：平均 {status.scorecard.average} / 5</summary>
      <p className={a.meta}>編集の参考にする目安です。点数で承認・公開が決まることはありません（承認できるかは上の「要修正」だけで決まります）。</p>
      <ul className={a.issues}>{status.scorecard.axes.map(x => <li key={x.key}><strong>{x.label}：{x.score === null ? '対象外' : `${x.score} / 5`}</strong>{x.notes.length ? <><br />{x.notes.join('、')}</> : null}</li>)}</ul></details> : null}
    <details><summary className={a.meta}>出典と取得日時（{status.sources.length}件）</summary><ol className={a.sources}>{status.sources.map((x, n) => <li key={n}>{x.id ? `${x.id}：` : ''}{x.label}：{x.fetched_at ? `取得 ${jst(x.fetched_at)}` : x.period ? `取得日時の記録なし（集計期間 ${x.period}）` : '取得日時の記録なし（収録データ）'}<br /><a href={x.url} target="_blank" rel="noreferrer noopener">{x.url}</a></li>)}</ol></details>
    {writable ? <details><summary className={a.meta}>人が追記した事実の出典を登録する</summary>
      <p className={a.meta}>本文に事実（数値など）を追記した場合は、確認したページと日時を登録します。登録すると記事の出典欄に追加されます。そのブロックの「このブロックの出典」で登録した出典を選ぶと、確認を通過します。登録後は再承認が必要です。</p>
      <form className={a.form} onSubmit={addSource}>
        <label>追記した事実<input value={fact.statement} maxLength={500} onChange={e => setFact({ ...fact, statement: e.target.value })} /></label>
        <label>出典名<input value={fact.source_label} maxLength={200} onChange={e => setFact({ ...fact, source_label: e.target.value })} /></label>
        <label>出典URL（https）<input value={fact.source_url} inputMode="url" onChange={e => setFact({ ...fact, source_url: e.target.value })} /></label>
        <label>確認した日時<input type="datetime-local" value={fact.checked_at} onChange={e => setFact({ ...fact, checked_at: e.target.value })} /></label>
        <label>登録者名<input value={fact.registered_by} maxLength={80} onChange={e => setFact({ ...fact, registered_by: e.target.value })} /></label>
        <button className={s.button} disabled={busy || !fact.registered_by.trim() || !fact.statement || !fact.source_label || !fact.source_url || !fact.checked_at}>出典を登録</button>
      </form></details> : null}
    {!current && writable && !status.comparison ? <div className={a.approve}><label>承認者名（記録されます）<input value={name} maxLength={80} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
      <button className={s.primary} disabled={busy || !name.trim() || autosave.status === 'conflict'} onClick={approve}>この版を承認する</button></div> : null}
    {message ? <p role="status" className={a.meta}>{message}</p> : null}
  </section>;
}
