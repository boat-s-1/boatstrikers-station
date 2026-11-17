'use client';
import { useCallback, useEffect, useState } from 'react';
import s from './blogAdmin.module.css';
import a from './aiAdmin.module.css';

const CHANNELS = [['note', 'note 原稿'], ['x', 'X 投稿'], ['youtube_script', 'YouTube ショート台本'], ['youtube_description', 'YouTube 概要欄']];
const CHARACTERS = [['', '記事の著者に合わせる'], ['ichika', '一果'], ['hatsune', '初音'], ['kiina', 'キイナ']];
const POSES = [['pose5', '案内'], ['pose1', '説明'], ['pose2', '考える'], ['pose3', '質問'], ['pose4', 'まとめ']];
const jst = v => v ? new Date(v).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '';
async function call(path, method = 'GET', body) {
  const res = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  let json; try { json = await res.json(); } catch { throw new Error('サーバーの応答を確認できません。'); }
  if (!res.ok) throw new Error(json.error || '処理に失敗しました。');
  return json;
}

// Cover regeneration (template, existing character art) and channel texts (note / X / YouTube).
export default function PostToolsPanel({ postId, autosave, writable }) {
  const [character, setCharacter] = useState(''), [pose, setPose] = useState('pose5');
  const [channels, setChannels] = useState(['note', 'x', 'youtube_script', 'youtube_description']), [name, setName] = useState('');
  const [items, setItems] = useState([]), [busy, setBusy] = useState(''), [message, setMessage] = useState('');
  const load = useCallback(async () => { try { setItems((await call(`/api/admin/blog/ai/posts/${postId}/derivatives`)).derivatives); } catch { setItems([]); } }, [postId]);
  useEffect(() => { load(); }, [load]);
  async function savedVersion() {
    const saved = await autosave.saveNow();
    if (saved.dirty || saved.status !== 'saved') throw new Error('保存できていない変更があります。保存してから操作してください。');
    return saved.version;
  }
  async function cover() {
    if (busy) return; setBusy('cover'); setMessage('');
    try { await call(`/api/admin/blog/ai/posts/${postId}/cover`, 'POST', { version: await savedVersion(), character: character || null, pose }); window.location.reload(); }
    catch (e) { setMessage(e.message); setBusy(''); }
  }
  async function generate() {
    if (busy) return; setBusy('derive'); setMessage('');
    try { setItems((await call(`/api/admin/blog/ai/posts/${postId}/derivatives`, 'POST', { channels, created_by: name })).derivatives); setMessage('原稿を作成しました。内容を確認してからコピーしてください（自動投稿はしません）。'); }
    catch (e) { setMessage(e.message); } finally { setBusy(''); }
  }
  async function discard(id) { try { await call(`/api/admin/blog/ai/posts/${postId}/derivatives`, 'POST', { action: 'discard', derivative_id: id }); await load(); } catch (e) { setMessage(e.message); } }
  async function copy(text) { try { await navigator.clipboard.writeText(text); setMessage('コピーしました。'); } catch { setMessage('コピーできませんでした。本文を選択してコピーしてください。'); } }
  const toggle = c => setChannels(list => list.includes(c) ? list.filter(x => x !== c) : [...list, c]);

  return <section className={a.review} aria-label="表紙とSNS・note原稿">
    <div className={a.reviewHead}><h2>表紙とSNS・note原稿</h2></div>
    <details><summary className={a.meta}>表紙画像を作り直す（既存のキャラクター素材のテンプレート）</summary>
      <p className={a.meta}>現在のタイトルで表紙とOGP画像を作り直し、記事に設定します。AI下書きの場合は、作り直した後に再承認が必要です。</p>
      <div className={a.form}><label>キャラクター<select value={character} onChange={e => setCharacter(e.target.value)}>{CHARACTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label>ポーズ<select value={pose} onChange={e => setPose(e.target.value)}>{POSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <button className={s.button} disabled={!writable || !!busy} onClick={cover}>{busy === 'cover' ? '作成中…' : '表紙を作り直す'}</button></div>
    </details>
    <details><summary className={a.meta}>note・X・YouTube向けの原稿を作る（承認済み・公開済みの記事のみ）</summary>
      <p className={a.meta}>記事の内容だけから原稿を作ります。記事にない数値や表現が含まれると「要修正」になります。投稿は自動では行いません。</p>
      <div className={a.form}>{CHANNELS.map(([v, l]) => <label key={v} style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={channels.includes(v)} onChange={() => toggle(v)} style={{ width: 'auto', minHeight: 0 }} />{l}</label>)}
        <label>作成者名<input value={name} maxLength={80} onChange={e => setName(e.target.value)} /></label>
        <button className={s.button} disabled={!writable || !!busy || !channels.length || !name.trim()} onClick={generate}>{busy === 'derive' ? '作成中…' : '原稿を作る'}</button></div>
      <div className={a.rows}>{items.map(d => <div key={d.id} className={a.row} style={{ display: 'block' }}>
        <strong>{CHANNELS.find(([v]) => v === d.channel)?.[1]}</strong> <span className={`${a.tag} ${d.blocking_issues ? a.tagBad : ''}`}>{d.blocking_issues ? `要修正 ${d.blocking_issues}件` : '確認OK'}</span> <span className={a.small}>{jst(d.created_at)}・{d.created_by}</span>
        {(d.validation || []).length ? <ul className={a.issues}>{d.validation.map((v, i) => <li key={i} data-level={v.level}>{v.message}</li>)}</ul> : null}
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, background: '#f7f8f4', padding: 12, borderRadius: 6, margin: '10px 0' }}>{d.body}</pre>
        <span className={a.rowActions}><button className={s.button} disabled={d.blocking_issues > 0} onClick={() => copy(d.body)}>コピー</button><button className={s.button} disabled={!writable} onClick={() => discard(d.id)}>削除</button></span>
      </div>)}</div>
    </details>
    {message ? <p role="status" className={a.meta}>{message}</p> : null}
  </section>;
}
