'use client';
import { useCallback, useEffect, useState } from 'react';

export default function AiOperationsPanel({ ready, writable }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    if (!ready) return;
    try {
      const res = await fetch('/api/admin/blog/ai/control', { cache: 'no-store', credentials: 'same-origin' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '状態の取得に失敗しました。');
      setStatus(json); setError('');
    } catch (e) { setError(e.message); }
  }, [ready]);
  useEffect(() => { refresh(); }, [refresh]);
  async function stop() {
    if (!window.confirm('AI生成と自動公開を停止します。実行しますか？')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/blog/ai/control', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'emergency_stop', confirmation: 'STOP' }),
      });
      const json = await res.json();
      if (!res.ok || !json.stopped) throw new Error(json.error || '停止に失敗しました。');
      await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section aria-label="AI運用監視" style={{ border: '1px solid #8886', borderRadius: 12, padding: 18, marginBottom: 20 }}>
    <h2>AI運用監視・緊急停止</h2>
    {error ? <p role="alert">{error}</p> : null}
    {!status ? <p>状態を確認中です。</p> : <>
      <p>AI生成：<strong>{status.settings.generation_enabled ? 'ON' : 'OFF'}</strong> ／ 自動公開：<strong>{status.settings.auto_publish_enabled ? 'ON' : 'OFF'}</strong> ／ 承認：{status.settings.approval_mode}</p>
      <button type="button" onClick={stop} disabled={!writable || busy || (!status.settings.generation_enabled && !status.settings.auto_publish_enabled)}>AI生成・自動公開を緊急停止</button>
      <button type="button" onClick={refresh} disabled={busy} style={{ marginLeft: 12 }}>状態を再取得</button>
      <h3>HOLD通知（管理画面内）: {status.holds.length}件</h3>
      <p>同一ジョブは1件として表示します。外部通知は送信しません。</p>
      {status.holds.length ? <ul>{status.holds.map(j => <li key={j.publish_date}>{j.publish_date}・{({ ichika: '一果', hatsune: '初音', kiina: 'キイナ' })[j.character_key] || j.character_key}・{j.last_error || '理由未記録'}・更新 {j.updated_at}</li>)}</ul> : <p>現在HOLDのジョブはありません。</p>}
    </>}
  </section>;
}
