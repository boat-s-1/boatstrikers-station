'use client';
import { useState } from 'react';
import { validateOfficialPost } from '../../../lib/community/postValidation.mjs';
import styles from '../community.module.css';

// UI preview only. This component intentionally has no write endpoint until
// the server authorization, RLS, moderation and audit gates are verified.
export default function PostComposer() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [character_key, setCharacter] = useState('ichika');
  const [audience, setAudience] = useState('public');
  const [reply_policy, setReplyPolicy] = useState('paid');
  const [preview, setPreview] = useState(false);
  const validation = validateOfficialPost({ title, body, excerpt, character_key, audience, reply_policy });
  const audiences = { public: '全ユーザー公開', members: '会員限定（無料・有料）', paid: '有料会員限定' };
  return <div className={styles.composer}>
    <p>これは管理画面の操作確認用プレビューです。入力内容は保存・送信されません。</p>
    <label>投稿キャラクター
      <select value={character_key} onChange={e => setCharacter(e.target.value)}>
        <option value="ichika">一果</option><option value="hatsune">初音</option><option value="kiina">キイナ</option>
      </select>
    </label>
    <label>タイトル<input maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label>
    <label>概要<textarea maxLength={240} value={excerpt} onChange={e => setExcerpt(e.target.value)} /></label>
    <label>本文<textarea rows={9} maxLength={20000} value={body} onChange={e => setBody(e.target.value)} /></label>
    <fieldset><legend>公開範囲</legend>
      {Object.entries(audiences).map(([value,label]) => <label key={value}>
        <input type="radio" name="audience" checked={audience === value} onChange={() => setAudience(value)}/>{label}
      </label>)}
    </fieldset>
    <fieldset><legend>返信設定</legend>
      <label><input type="radio" name="reply" checked={reply_policy === 'paid'} onChange={() => setReplyPolicy('paid')}/>有料会員のみ返信可能</label>
      <label><input type="radio" name="reply" checked={reply_policy === 'disabled'} onChange={() => setReplyPolicy('disabled')}/>返信停止</label>
    </fieldset>
    <button type="button" onClick={() => setPreview(true)}>内容をプレビュー</button>
    {preview && <section aria-live="polite">
      {validation.valid ? <><h2>{validation.value.title}</h2><p>{audiences[audience]} ／ {reply_policy === 'paid' ? '有料会員のみ返信可能' : '返信停止'}</p><p>{validation.value.excerpt}</p><article style={{whiteSpace:'pre-wrap'}}>{validation.value.body}</article></>
      : <ul>{validation.errors.map(error => <li key={error}>{error}</li>)}</ul>}
    </section>}
  </div>;
}
