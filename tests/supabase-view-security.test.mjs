import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMigrations, readMigrations, stripSql, viewName } from '../scripts/check-view-security.mjs';

const run = (...sqls) => analyzeMigrations(sqls.map((sql, i) => ({ name: `${String(i).padStart(3, '0')}.sql`, sql })));
const problems = (result) => result.violations.map((v) => `${v.view}:${v.problem}`);

test('リポジトリの migrations：すべての public ビューが security_invoker で、anon への書き込み権限の付与もない', () => {
  const result = analyzeMigrations(readMigrations('supabase/migrations'));
  assert.deepEqual(result.violations, []);
  assert.ok(result.views >= 6);
});

test('S1 の5件は、S1 の記録が無ければ違反として検出される（検査が実際に効くこと）', () => {
  const files = readMigrations('supabase/migrations').filter((f) => !f.name.includes('s1_view_security_invoker'));
  const flagged = analyzeMigrations(files).violations.map((v) => v.view);
  assert.ok(flagged.includes('v_bsc_official_performance'));
  assert.ok(flagged.includes('v_elimination_training_entries'));
});

test('CREATE VIEW：WITH (security_invoker = true) が無ければ違反、あれば合格', () => {
  assert.deepEqual(problems(run('create view public.v1 as select 1;')), ['v1:security_invoker なし']);
  assert.deepEqual(problems(run('create view public.v1 with (security_invoker = true) as select 1;')), []);
  assert.deepEqual(problems(run('create view v1 with (security_invoker=on) as select 1;')), []);
  assert.deepEqual(problems(run('CREATE VIEW "public"."v1" WITH (security_barrier, security_invoker) AS SELECT 1;')), []);
  assert.deepEqual(problems(run('create view public.v1 (a) with (security_invoker = true) as select 1;')), []);
  assert.deepEqual(problems(run('create view public.v1 with (security_invoker = false) as select 1;')), ['v1:security_invoker なし']);
});

test('CREATE OR REPLACE VIEW は以前の設定を消す（WITH が無ければ違反に戻る）', () => {
  const created = 'create view public.v1 with (security_invoker = true) as select 1;';
  assert.deepEqual(problems(run(created, 'create or replace view public.v1 as select 2;')), ['v1:security_invoker なし']);
  assert.deepEqual(problems(run(created, 'create or replace view public.v1 with (security_invoker = true) as select 2;')), []);
  // 一度 ALTER で直しても、その後の WITH なしの置き換えで再び違反
  assert.deepEqual(problems(run('create view public.v1 as select 1;', 'alter view public.v1 set (security_invoker = true);', 'create or replace view public.v1 as select 3;')), ['v1:security_invoker なし']);
});

test('ALTER VIEW：SET で合格、RESET・false で違反', () => {
  assert.deepEqual(problems(run('create view public.v1 as select 1;', 'alter view public.v1 set (security_invoker = true);')), []);
  assert.deepEqual(problems(run('create view public.v1 with (security_invoker = true) as select 1;', 'alter view public.v1 reset (security_invoker);')), ['v1:security_invoker なし']);
  assert.deepEqual(problems(run('create view public.v1 with (security_invoker = true) as select 1;', 'alter view if exists public.v1 set (security_invoker = false);')), ['v1:security_invoker なし']);
  // 他のオプションの変更は invoker に影響しない
  assert.deepEqual(problems(run('create view public.v1 with (security_invoker = true) as select 1;', 'alter view public.v1 set (security_barrier = true);')), []);
});

test('DROP VIEW で追跡をやめる。DROP → CREATE の作り直しでも WITH が必要', () => {
  assert.deepEqual(problems(run('create view public.v1 as select 1;', 'drop view if exists public.v1 cascade;')), []);
  assert.deepEqual(problems(run('create view public.v1 with (security_invoker = true) as select 1;', 'drop view public.v1;', 'create view public.v1 as select 1;')), ['v1:security_invoker なし']);
});

test('anon・authenticated へのビューの書き込み権限の付与は違反。必要な REVOKE があれば解消', () => {
  const created = 'create view public.v1 with (security_invoker = true) as select 1;';
  assert.deepEqual(problems(run(created, 'grant all on public.v1 to anon, authenticated;')), ['v1:anon・authenticated への書き込み権限の付与']);
  assert.deepEqual(problems(run(created, 'grant select on public.v1 to anon;')), []);
  assert.deepEqual(problems(run(created, 'grant update on table public.v1 to authenticated;')), ['v1:anon・authenticated への書き込み権限の付与']);
  assert.deepEqual(problems(run(created, 'grant all on public.v1 to anon;', 'revoke insert, update, delete, truncate on public.v1 from anon, authenticated;')), []);
  assert.deepEqual(problems(run(created, 'grant all on public.v1 to service_role;')), []); // service_role は対象外
});

test('対象外：public 以外のスキーマ、マテリアライズドビュー、関数本体の中の文字列、コメント', () => {
  assert.deepEqual(problems(run('create view private.v1 as select 1;')), []);
  assert.deepEqual(problems(run('create materialized view public.mv as select 1;')), []);
  assert.deepEqual(problems(run("create function f() returns void language plpgsql as $$ begin execute 'x'; end $$; create view public.ok with (security_invoker = true) as select 1;")), []);
  assert.deepEqual(problems(run("do $body$ begin raise notice 'create view public.fake as select 1'; end $body$;")), []);
  assert.deepEqual(problems(run('-- create view public.c1 as select 1;\n/* create view public.c2 as select 1; */ select 1;')), []);
  assert.equal(viewName('"public"."V_Name"'), 'v_name');
  assert.equal(viewName('other.v'), null);
  assert.equal(stripSql('a $$ create view x $$ b').includes('create view'), false);
});
