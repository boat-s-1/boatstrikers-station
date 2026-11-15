import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const branch = 'codex/batch1-reconstructed-20261115';
const e = process.env;
if (e.BATCH1_REVIEW_ONLY !== '1' || e.BATCH1_SOURCE_REF !== branch ||
    (e.VERCEL_ENV && e.VERCEL_ENV !== 'preview') ||
    (e.VERCEL_GIT_COMMIT_REF && e.VERCEL_GIT_COMMIT_REF !== branch)) throw new Error('Review context rejected');
for (const [key, value] of Object.entries(e)) {
  if (value && /SUPABASE|FIREBASE|^BLOG_|SECRET|TOKEN|PASSWORD|API_KEY|NODE_OPTIONS/i.test(key)) {
    throw new Error('Credential-bearing environment rejected');
  }
}
const out = fileURLToPath(new URL('./public/', import.meta.url));
mkdirSync(out, { recursive: true });
writeFileSync(out + 'index.html', `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"><title>BATCH1 静的レビュー見本</title><style>body{max-width:50rem;margin:auto;padding:2rem;font-family:sans-serif}button{padding:1rem}</style><h1>BATCH1 静的レビュー見本</h1><p>合成データ 2099-01-01。実アプリの動作試験ではありません。</p><p>日次まとめ：完了 / SNS下書き：未生成</p><button disabled>生成は実行できません</button><p>DB・認証・API・Cron・投稿機能はありません。</p></html>`);
writeFileSync(out + '404.html', '<!doctype html><html lang="ja"><meta charset="utf-8"><title>404</title><p>ページがありません。</p></html>');
writeFileSync(out + 'isolation.json', JSON.stringify({ synthetic: true, database: false, functions: false, cron: false }));
