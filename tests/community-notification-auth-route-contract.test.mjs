import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const route=resolve(root,'app/api/community/notifications/auth-check/route.js');
const source=readFileSync(route,'utf8');
test('auth-check route imports resolve within repository',()=>{
 const imports=[...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(m=>m[1]);
 for (const specifier of imports.filter(x=>x.startsWith('.'))) {
  const target=resolve(dirname(route),specifier);
  assert.equal(existsSync(target)||existsSync(target+'.js')||existsSync(target+'.mjs'),true,`missing import: ${specifier}`);
 }
});
test('auth-check route remains GET-only and has no notification mutation',()=>{
 assert.match(source,/export async function GET\(/);
 assert.doesNotMatch(source,/export async function (POST|PUT|PATCH|DELETE)\(/);
 assert.doesNotMatch(source,/service_role|\.insert\(|\.update\(|\.delete\(/i);
 assert.match(source,/force-dynamic/);
});
