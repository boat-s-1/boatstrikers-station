import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { discordAlertsCronSecret, isDiscordAlertsCronAuthorized } from '../app/lib/discordAlertsCronAuth.js';

// テスト用のダミー値（本物の秘密値ではない）
const DEDICATED = 'test-discord-alerts-secret-0123456789abcdef';
const SHARED = 'test-shared-cron-secret-fedcba9876543210';
const req = (authorization) => new Request('https://example.test/api/cron/discord-alerts', { headers: authorization === undefined ? {} : { authorization } });

test('専用キーが設定済み：専用キーの Bearer だけを受け付け、CRON_SECRET では通らない', () => {
  const env = { DISCORD_ALERTS_CRON_SECRET: DEDICATED, CRON_SECRET: SHARED };
  assert.equal(isDiscordAlertsCronAuthorized(req(`Bearer ${DEDICATED}`), env), true);
  assert.equal(isDiscordAlertsCronAuthorized(req(`Bearer ${SHARED}`), env), false); // 旧キーは拒否
  assert.equal(discordAlertsCronSecret(env).source, 'DISCORD_ALERTS_CRON_SECRET');
});

test('専用キーが未設定：従来どおり CRON_SECRET の Bearer を受け付ける', () => {
  for (const env of [{ CRON_SECRET: SHARED }, { CRON_SECRET: SHARED, DISCORD_ALERTS_CRON_SECRET: '' }, { CRON_SECRET: SHARED, DISCORD_ALERTS_CRON_SECRET: '   ' }]) {
    assert.equal(isDiscordAlertsCronAuthorized(req(`Bearer ${SHARED}`), env), true);
    assert.equal(isDiscordAlertsCronAuthorized(req(`Bearer ${DEDICATED}`), env), false);
    assert.equal(discordAlertsCronSecret(env).source, 'CRON_SECRET');
  }
});

test('どちらも未設定なら常に拒否（空の Bearer も通らない）', () => {
  for (const env of [{}, { CRON_SECRET: '', DISCORD_ALERTS_CRON_SECRET: '' }, { CRON_SECRET: '  ' }]) {
    assert.equal(isDiscordAlertsCronAuthorized(req('Bearer '), env), false);
    assert.equal(isDiscordAlertsCronAuthorized(req('Bearer undefined'), env), false);
    assert.equal(isDiscordAlertsCronAuthorized(req(undefined), env), false);
    assert.equal(discordAlertsCronSecret(env).source, 'none');
  }
});

test('ヘッダーの形が違えば拒否：無し・Bearer 無し・大文字小文字・空白の数・一部一致・別方式', () => {
  const env = { DISCORD_ALERTS_CRON_SECRET: DEDICATED };
  for (const header of [undefined, '', DEDICATED, `bearer ${DEDICATED}`, `Bearer  ${DEDICATED}`, `Bearer ${DEDICATED.slice(0, -1)}`, `Bearer ${DEDICATED}x`, `Basic ${DEDICATED}`]) {
    assert.equal(isDiscordAlertsCronAuthorized(req(header), env), false, String(header));
  }
});

// 変更前の route の authorized() をそのまま写したもの（比較用）
function previousAuthorized(request, env) {
  const secret = env.CRON_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

test('専用キーが未設定なら、判定は変更前の実装と同じ（さまざまな値・ヘッダーで比較）', () => {
  const secrets = [SHARED, `${SHARED} `, `x`, `日本語の値`, `a b c`];
  const headersFor = (secret) => [undefined, '', `Bearer ${secret}`, `Bearer ${secret} `, ` Bearer ${secret}`, `bearer ${secret}`, `Bearer ${secret}x`, `Bearer ${SHARED}`, `Bearer ${DEDICATED}`, secret];
  let cases = 0;
  for (const secret of secrets) {
    for (const header of headersFor(secret)) {
      let request;
      try { request = req(header); } catch { continue; } // Headers が受け付けない値は対象外（変更前も同じ）
      for (const env of [{ CRON_SECRET: secret }, { CRON_SECRET: secret, DISCORD_ALERTS_CRON_SECRET: '' }]) {
        assert.equal(isDiscordAlertsCronAuthorized(request, env), previousAuthorized(request, env), `${JSON.stringify(secret)} / ${JSON.stringify(header)}`);
        cases += 1;
      }
    }
  }
  assert.ok(cases >= 80);
  // 唯一の違い：空白だけの CRON_SECRET は「未設定」とみなして拒否する（変更前は "Bearer " ＋空白と一致し得た）
  assert.equal(isDiscordAlertsCronAuthorized(req('Bearer'), { CRON_SECRET: ' ' }), false);
});

test('discord-alerts の route だけが専用キーを使い、秘密値やヘッダーをログに出さない', () => {
  const route = readFileSync('app/api/cron/discord-alerts/route.js', 'utf8');
  assert.match(route, /import \{ isDiscordAlertsCronAuthorized \} from "\.\.\/\.\.\/\.\.\/lib\/discordAlertsCronAuth";/);
  assert.match(route, /function authorized\(request\)\{\n\s*return isDiscordAlertsCronAuthorized\(request\);\n\}/);
  assert.doesNotMatch(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /if\(!authorized\(request\)\)return NextResponse\.json\(\{ok:false,error:"unauthorized"\},\{status:401\}\);/);
  // 認証の値やヘッダーをログ・応答に出さない
  for (const src of [route, readFileSync('app/lib/discordAlertsCronAuth.js', 'utf8')]) {
    assert.doesNotMatch(src, /console\.[a-z]+\([^)]*(secret|authorization|CRON_SECRET)/i);
  }
});

test('Discord の5つの cron だけが専用認証ヘルパーを使用する', () => {
  const discordRoutes = ['discord-alerts', 'discord-race-threads', 'discord-community-setup', 'discord-membership-sync', 'discord-community-poll'];
  const users = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(p);
      else if (/\.(js|mjs)$/.test(entry.name) && /DISCORD_ALERTS_CRON_SECRET|discordAlertsCronAuth/.test(readFileSync(p, 'utf8'))) users.push(p);
    }
  };
  walk('app');
  walk('lib');
  assert.deepEqual(users.sort(), [...discordRoutes.map(name => `app/api/cron/${name}/route.js`), 'app/lib/discordAlertsCronAuth.js'].sort());
  for (const name of discordRoutes) {
    const route = readFileSync(`app/api/cron/${name}/route.js`, 'utf8');
    assert.match(route, /import \{ isDiscordAlertsCronAuthorized \} from "\.\.\/\.\.\/\.\.\/lib\/discordAlertsCronAuth";/);
    assert.match(route, /function authorized\(request\)\{\n\s*return isDiscordAlertsCronAuthorized\(request\);\n\}/);
    assert.doesNotMatch(route, /process\.env\.CRON_SECRET/);
    assert.match(route, /if\(!authorized\(request\)\)return NextResponse\.json\(\{ok:false,error:"unauthorized"\},\{status:401\}\);/);
  }
});
