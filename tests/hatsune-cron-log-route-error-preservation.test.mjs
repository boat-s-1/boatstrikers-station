import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../app/api/cron/hatsune-news-pipeline/route.js', import.meta.url), 'utf8');

test('pipeline catch preserves original error if finish transport throws', () => {
  const catchStart = source.lastIndexOf('  } catch (error) {');
  assert.ok(catchStart > 0);
  const catchBody = source.slice(catchStart);
  assert.match(catchBody, /const message = error\?\.message \|\| String\(error\)/);
  assert.match(catchBody, /try \{\s*await finishHatsuneCronRun\(\{[\s\S]*?status: "error"/);
  assert.match(catchBody, /catch \(finishError\) \{[\s\S]*?console\.error\("Hatsune cron log finish transport failed"/);
  assert.match(catchBody, /return NextResponse\.json\(\{ ok: false, error: message \}, \{ status: 500 \}\)/);
});
