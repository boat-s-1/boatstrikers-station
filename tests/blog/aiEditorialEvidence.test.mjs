import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInstructions } from '../../lib/blog/ai/prompt.mjs';

test('editorial prompt requires evidence-backed persona analysis and truthful titles', () => {
  // Guard the safety-critical editorial contract without calling the AI or a database.
  const source = buildInstructions.toString();
  assert.match(source, /キャラクター別の分析品質/);
  assert.match(source, /1着率だけでは勝った展開を特定できない/);
  assert.match(source, /女子戦特有の原因や選手の能力差を推測しません/);
  assert.match(source, /本文にない分析をタイトルやSEO文だけで約束しません/);
});
