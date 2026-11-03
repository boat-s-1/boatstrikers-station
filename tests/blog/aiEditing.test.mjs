import test from 'node:test';
import assert from 'node:assert/strict';
import { NOW, basicsTopic, goodAi, memoryStore, memoryRepo, fakeCover, html, fakeFetch } from './_aiFixtures.mjs';
import { storedPack, storedDocument } from './_kiryuRegression.mjs';
import { listItems, tableRows, tableWidth, blockSourceIds, setBlockSources, emptyItems, emptyCells, raggedRows, unknownSourceIds, CITABLE_TYPES, LIST_MAX_ITEMS, TABLE_MAX_COLUMNS } from '../../lib/blog/blockEdits.mjs';
import { validateDocument } from '../../lib/blog/document.mjs';
import { validateAiDocument, blockingCount } from '../../lib/blog/ai/validate.mjs';
import { runDraftPipeline } from '../../lib/blog/ai/pipeline.mjs';
import { approveDraft, draftStatus, assertRegisteredCitations, listApprovalState } from '../../lib/blog/ai/approval.mjs';
import { addManualSource } from '../../lib/blog/ai/manualSources.mjs';

const session = { hash: 'a'.repeat(32), loginAt: NOW().toISOString() };
const codes = issues => issues.filter(i => i.level === 'blocking').map(i => i.code).sort();
const pickerSources = storedPack.sources.map(s => ({ id: s.id, label: s.label, url: s.url }));
async function drafted() {
  const store = memoryStore(), repo = memoryRepo();
  const r = await runDraftPipeline({ topicId: basicsTopic.id, store, repo, renderCover: fakeCover, now: NOW,
    fetchImpl: fakeFetch({ default: { body: html('桐生の場データのページです。コース別の成績などを掲載しています。') } }), callAi: async () => ({ data: goodAi(), model: 'm' }) });
  return { store, repo, postId: r.post_id };
}
const editBlock = (doc, i, data) => ({ ...doc, blocks: doc.blocks.map((b, n) => (n === i ? { ...b, data } : b)) });

test('list items: edit, add, remove and reorder without touching the original', () => {
  const items = ['a', 'b', 'c'];
  assert.deepEqual(listItems.set(items, 1, 'B'), ['a', 'B', 'c']);
  assert.deepEqual(listItems.add(items), ['a', 'b', 'c', '']);
  assert.deepEqual(listItems.remove(items, 0), ['b', 'c']);
  assert.deepEqual(listItems.move(items, 2, -1), ['a', 'c', 'b']);
  assert.equal(listItems.move(items, 0, -1), items); assert.equal(listItems.set(items, 9, 'x'), items);
  assert.equal(listItems.add(Array(LIST_MAX_ITEMS).fill('x')).length, LIST_MAX_ITEMS);
  assert.deepEqual(items, ['a', 'b', 'c']);
});

test('table rows: cells, rows and columns stay rectangular and within limits', () => {
  const ragged = [['コース', '1着率'], ['1']]; // older documents may have short rows
  assert.deepEqual(tableRows.setCell(ragged, 1, 1, '54.7%'), [['コース', '1着率'], ['1', '54.7%']]);
  assert.deepEqual(tableRows.addRow(ragged), [['コース', '1着率'], ['1', ''], ['', '']]);
  assert.deepEqual(tableRows.addColumn(ragged), [['コース', '1着率', ''], ['1', '', '']]);
  assert.deepEqual(tableRows.removeColumn([['a', 'b'], ['c', 'd']], 0), [['b'], ['d']]);
  assert.deepEqual(tableRows.removeRow([['a'], ['b']], 0), [['b']]);
  assert.deepEqual(tableRows.removeRow([['a']], 0), [['a']], 'the last row stays');
  assert.deepEqual(tableRows.removeColumn([['a'], ['b']], 0), [['a'], ['b']], 'the last column stays');
  assert.deepEqual(tableRows.moveRow([['a'], ['b']], 1, -1), [['b'], ['a']]);
  assert.equal(tableWidth(tableRows.addColumn([Array(TABLE_MAX_COLUMNS).fill('x')])), TABLE_MAX_COLUMNS);
  assert.deepEqual(ragged, [['コース', '1着率'], ['1']]);
});

test('LIST and TABLE edits are saved and kept after reloading; empty items and cells are pointed out', async () => {
  const { repo, postId } = await drafted();
  const before = await repo.editor(postId);
  const at = before.document.blocks.findIndex(b => b.type === 'LIST');
  let doc = editBlock(before.document, at, { ...before.document.blocks[at].data, items: listItems.add(listItems.set(before.document.blocks[at].data.items, 0, '桐生は淡水です')) });
  doc.blocks[at].data.items[doc.blocks[at].data.items.length - 1] = '干満差はなし';
  const table = { id: crypto.randomUUID(), type: 'TABLE', data: { caption: '水面の基本', header: true, rows: tableRows.setCell(tableRows.addRow([['項目', '内容']]), 1, 0, '水質') } };
  table.data.rows = tableRows.setCell(table.data.rows, 1, 1, '淡水');
  doc = { ...doc, blocks: [...doc.blocks, table] };
  const saved = await repo.save(postId, before.version, doc);
  const reloaded = await repo.editor(postId);
  assert.equal(reloaded.version, saved.version);
  assert.deepEqual(reloaded.document.blocks[at].data.items.slice(0, 1), ['桐生は淡水です']);
  assert.equal(reloaded.document.blocks[at].data.items.at(-1), '干満差はなし');
  assert.deepEqual(reloaded.document.blocks.at(-1).data, { caption: '水面の基本', header: true, rows: [['項目', '内容'], ['水質', '淡水']] });
  // Saved documents may contain empty entries (unchanged rule, so older documents keep saving); the editor flags them.
  assert.equal(emptyItems(listItems.add(['a'])), true); assert.equal(emptyItems(['a', 'b']), false);
  assert.equal(emptyCells(tableRows.addColumn([['a']])), true); assert.equal(emptyCells([['a', 'b'], ['c']]), true); assert.equal(emptyCells([['a']]), false);
  assert.throws(() => validateDocument(editBlock(reloaded.document, at, { items: 'a' })), /リスト/);
  assert.throws(() => validateDocument({ ...reloaded.document, blocks: [...reloaded.document.blocks, { id: crypto.randomUUID(), type: 'TABLE', data: { rows: [['a', 1]] } }] }), /表/);
});

test('citations: only the article\'s sources can be chosen, and add / change / remove follow compose\'s format', () => {
  const text = storedDocument.blocks[6].data; // cited S1 by the AI
  assert.deepEqual(blockSourceIds(text, pickerSources), ['S1']);
  const both = setBlockSources(text, ['S2', 'S1', 'S9'], pickerSources); // S9 is not registered for this article
  assert.deepEqual(both.source_ids, ['S1', 'S2']); assert.equal(both.source_url, storedPack.sources[0].url);
  assert.equal(both.source_label, `${storedPack.sources[0].label} / ${storedPack.sources[1].label}`);
  const none = setBlockSources(text, [], pickerSources);
  assert.ok(!('source_ids' in none) && !('source_url' in none) && !('source_label' in none)); assert.equal(none.text, text.text);
  // A human QUOTE that only has a URL resolves to the registered sources with that URL.
  assert.deepEqual(blockSourceIds({ text: 'x', source_url: storedPack.sources[1].url }, pickerSources), ['S1', 'S2']);
  assert.ok(CITABLE_TYPES.includes('LIST') && CITABLE_TYPES.includes('TABLE') && !CITABLE_TYPES.includes('HEADING'));
});

test('citations edited in the editor are re-checked: the Kiryu draft can now be fixed, and wrong choices are caught', () => {
  assert.deepEqual(codes(validateAiDocument({ document: storedDocument, pack: storedPack })), ['missing_source', 'missing_source']);
  // Fix: give the takeaways list and the summary their source (S1 records the 2026/05/01〜07/31 period).
  let doc = editBlock(storedDocument, 0, setBlockSources(storedDocument.blocks[0].data, ['S1'], pickerSources));
  doc = editBlock(doc, 16, setBlockSources(doc.blocks[16].data, ['S1'], pickerSources));
  assert.equal(blockingCount(validateAiDocument({ document: doc, pack: storedPack })), 0);
  // Change to the wrong source: the 52.2% figures are not on the page fetched that day (S2).
  assert.deepEqual(codes(validateAiDocument({ document: editBlock(doc, 6, setBlockSources(doc.blocks[6].data, ['S2'], pickerSources)), pack: storedPack })), ['source_mismatch']);
  // Remove the source: the figures are uncited again.
  assert.deepEqual(codes(validateAiDocument({ document: editBlock(doc, 6, setBlockSources(doc.blocks[6].data, [], pickerSources)), pack: storedPack })), ['missing_source']);
  // A crafted save with an unregistered id is refused even though its URL is registered.
  assert.deepEqual(codes(validateAiDocument({ document: editBlock(doc, 6, { ...doc.blocks[6].data, source_ids: ['S1', 'X9'] }), pack: storedPack })), ['unknown_source']);
  // A figure typed into a list item after editing is checked against the list's own source.
  const list = doc.blocks[7].data;
  assert.deepEqual(codes(validateAiDocument({ document: editBlock(doc, 7, { ...list, items: listItems.set(list.items, 0, '1コース：61.0％') }), pack: storedPack })), ['unsupported_number']);
});

test('editor status re-checks the saved version, and any edit (text, list or citation only) withdraws the approval', async () => {
  const { store, repo, postId } = await drafted();
  const v1 = (await repo.editor(postId)).version;
  assert.equal((await approveDraft({ repo, store, postId, version: v1, name: '山田', session })).approved, true);
  let status = await draftStatus({ repo, store, postId });
  assert.equal(status.approved_current, true); assert.equal(status.checked_version, v1);
  assert.ok(status.sources.every(s => s.id && s.url), 'the picker gets the ids of the registered sources');

  // Citation-only change (same text): a new version, so the approval no longer applies.
  let editor = await repo.editor(postId);
  const cited = editor.document.blocks.findIndex(b => b.data?.source_ids?.length && !b.data.placement && /\d/.test(b.data.text || '')); // a cited figure (52.2%)
  let saved = await repo.save(postId, editor.version, editBlock(editor.document, cited, setBlockSources(editor.document.blocks[cited].data, [], status.sources)));
  status = await draftStatus({ repo, store, postId });
  assert.equal(status.approved_current, false); assert.equal(status.checked_version, saved.version);
  assert.ok(status.validation.some(i => i.code === 'missing_source' && i.level === 'blocking'), 'the live check sees the removed citation');
  assert.equal((await approveDraft({ repo, store, postId, version: saved.version, name: '山田', session })).approved, false);

  // Put the citation back and edit a list item: the check passes again, but a fresh approval is required.
  editor = await repo.editor(postId);
  let doc = editBlock(editor.document, cited, setBlockSources(editor.document.blocks[cited].data, ['S1'], status.sources));
  const at = doc.blocks.findIndex(b => b.type === 'LIST');
  doc = editBlock(doc, at, { ...doc.blocks[at].data, items: listItems.set(doc.blocks[at].data.items, 0, '桐生の水質と干満差（公式データ）') });
  saved = await repo.save(postId, editor.version, doc);
  status = await draftStatus({ repo, store, postId });
  assert.equal(status.approved_current, false); assert.equal(status.live_blocking, 0);
  assert.ok(status.validation.some(i => i.origin === 'generation' && i.code === 'needs_check'), 'notes from generation are still shown');
  assert.equal((await approveDraft({ repo, store, postId, version: saved.version, name: '山田', session })).approved, true);
  assert.equal((await draftStatus({ repo, store, postId })).approved_current, true);
});

test('compatibility: existing documents and non-AI posts keep working', async () => {
  // Older lists without citations, tables with short rows, and URL-only citations still validate and edit.
  const old = { schema_version: 1, title: 't', excerpt: '', category_id: null, seo: {}, cover: {}, noindex: false, author_ids: [], tag_ids: [], relations: [],
    blocks: [{ id: crypto.randomUUID(), type: 'LIST', data: { items: ['a'] } }, { id: crypto.randomUUID(), type: 'TABLE', data: { rows: [['a', 'b'], ['c']] } },
      { id: crypto.randomUUID(), type: 'QUOTE', data: { text: 'q', source_url: 'https://example.com/' } }] };
  assert.doesNotThrow(() => validateDocument(old));
  assert.deepEqual(tableRows.setCell(old.blocks[1].data.rows, 1, 1, 'd'), [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(blockSourceIds(old.blocks[2].data, []), []);
  // A post without an AI draft has no sources to choose from (the editor keeps its free URL field for QUOTE).
  const store = memoryStore(), repo = memoryRepo();
  const { id } = await repo.create('human-post', old);
  assert.deepEqual(await draftStatus({ repo, store, postId: id }), { ai: false });
});

test('approval keeps the notes made at generation, whether the check passes or not', async () => {
  const { store, repo, postId } = await drafted();
  const generated = store.state.drafts.get(postId).validation.filter(i => i.code === 'needs_check');
  assert.ok(generated.length);
  // A failing attempt (citation removed) records the live problems plus the generation notes.
  let editor = await repo.editor(postId);
  const cited = editor.document.blocks.findIndex(b => b.data?.source_ids?.length && /\d/.test(b.data.text || ''));
  let saved = await repo.save(postId, editor.version, editBlock(editor.document, cited, setBlockSources(editor.document.blocks[cited].data, [], [])));
  assert.equal((await approveDraft({ repo, store, postId, version: saved.version, name: '山田', session })).approved, false);
  let recorded = store.state.drafts.get(postId);
  assert.ok(recorded.validation.some(i => i.code === 'missing_source')); assert.deepEqual(recorded.validation.filter(i => i.code === 'needs_check'), generated);
  assert.equal(recorded.blocking_issues, recorded.validation.filter(i => i.level === 'blocking').length);
  // A passing attempt keeps them too, and the editor still shows them as notes from generation.
  editor = await repo.editor(postId);
  saved = await repo.save(postId, editor.version, editBlock(editor.document, cited, setBlockSources(editor.document.blocks[cited].data, ['S1'], (await draftStatus({ repo, store, postId })).sources)));
  assert.equal((await approveDraft({ repo, store, postId, version: saved.version, name: '山田', session })).approved, true);
  assert.deepEqual(store.state.drafts.get(postId).validation.filter(i => i.code === 'needs_check'), generated);
  assert.ok((await draftStatus({ repo, store, postId })).validation.some(i => i.code === 'needs_check' && i.origin === 'generation'));
});

test('empty list items, empty rows and uneven tables are handled explicitly and reported as warnings', () => {
  assert.deepEqual(listItems.compact(['a', ' ', '', 'b']), ['a', 'b']);
  assert.equal(raggedRows([['a', 'b'], ['c']]), true); assert.equal(raggedRows([['a'], ['b']]), false);
  assert.deepEqual(tableRows.normalize([['a', 'b'], ['c']]), [['a', 'b'], ['c', '']]);
  assert.deepEqual(tableRows.dropEmptyRows([['a', 'b'], ['', ' '], ['c']]), [['a', 'b'], ['c', '']]);
  assert.deepEqual(tableRows.dropEmptyRows([['', '']]), [['', '']], 'one row always stays');
  const doc = { ...storedDocument, blocks: [...storedDocument.blocks,
    { id: 'l', type: 'LIST', data: { items: ['a', ''] } }, { id: 'e', type: 'LIST', data: { items: [] } }, { id: 't', type: 'TABLE', data: { rows: [['a', 'b'], ['c']] } }] };
  const warnings = validateAiDocument({ document: doc, pack: storedPack }).filter(i => i.code === 'empty_entries');
  assert.deepEqual(warnings.map(i => [i.level, i.message.split('：')[0]]), [['warning', 'ブロック21（LIST）'], ['warning', 'ブロック22（LIST）'], ['warning', 'ブロック23（TABLE）']]);
});

test('unregistered source ids cannot be saved for an AI draft; manual sources and normal posts are unaffected', async () => {
  const { store, repo, postId } = await drafted();
  const editor = await repo.editor(postId);
  const cited = editor.document.blocks.findIndex(b => b.data?.source_ids?.length);
  const bad = editBlock(editor.document, cited, { ...editor.document.blocks[cited].data, source_ids: ['S1', 'S9'] });
  assert.deepEqual(unknownSourceIds(bad, ['S1', 'S2']), [{ index: cited, ids: ['S9'] }]);
  await assert.rejects(() => assertRegisteredCitations({ store, postId, document: bad }), e => e.status === 422 && /S9/.test(e.message));
  await assertRegisteredCitations({ store, postId, document: editor.document });
  // A source registered by a reviewer (M1) becomes selectable and savable.
  await addManualSource({ repo, store, postId, version: editor.version, now: NOW,
    input: { statement: '観覧席は1,200席', source_label: '桐生 施設案内', source_url: 'https://www.kiryu.example/facility', checked_at: '2026-10-09T01:30:00Z', registered_by: '山田' } });
  const withManual = editBlock(editor.document, cited, { ...editor.document.blocks[cited].data, source_ids: ['M1'] });
  await assertRegisteredCitations({ store, postId, document: withManual });
  assert.ok((await draftStatus({ repo, store, postId })).sources.some(s => s.id === 'M1'));
  // Posts without an AI draft keep saving as before, even with stray ids.
  const { id } = await repo.create('normal-post', { ...editor.document, blocks: [editor.document.blocks[cited]] });
  await assertRegisteredCitations({ store, postId: id, document: bad });
});

test('the drafts list shows "approved" only while the approval matches the current version', () => {
  const post = { id: 'p', edit_version: 5, editing_revision_id: 'r2' };
  assert.equal(listApprovalState({ status: 'needs_review' }, post, null), 'needs_review');
  assert.equal(listApprovalState({ status: 'approved' }, post, { edit_version: 5, revision_id: 'r2' }), 'approved');
  assert.equal(listApprovalState({ status: 'approved' }, post, { edit_version: 4, revision_id: 'r2' }), 'reapproval_needed', 'edited after approval');
  assert.equal(listApprovalState({ status: 'approved' }, { ...post, editing_revision_id: null }, { edit_version: 5, revision_id: 'r2' }), 'reapproval_needed', 'released, then a new revision');
  assert.equal(listApprovalState({ status: 'rejected' }, post, { edit_version: 5, revision_id: 'r2' }), 'rejected');
});

test('LIST / TABLE contents and their source ids are kept after save and reload', async () => {
  const { store, repo, postId } = await drafted();
  const sources = (await draftStatus({ repo, store, postId })).sources;
  const editor = await repo.editor(postId);
  const table = { id: crypto.randomUUID(), type: 'TABLE', data: setBlockSources({ header: true, rows: [['項目', '内容'], ['水質', '淡水']] }, ['S1'], sources) };
  const at = editor.document.blocks.findIndex(b => b.type === 'LIST');
  const doc = editBlock({ ...editor.document, blocks: [...editor.document.blocks, table] }, at, setBlockSources({ ...editor.document.blocks[at].data, items: ['桐生は淡水', '干満差なし'] }, ['S1'], sources));
  await assertRegisteredCitations({ store, postId, document: doc });
  await repo.save(postId, editor.version, doc);
  const reloaded = (await repo.editor(postId)).document;
  assert.deepEqual(reloaded.blocks[at].data.items, ['桐生は淡水', '干満差なし']); assert.deepEqual(reloaded.blocks[at].data.source_ids, ['S1']);
  assert.deepEqual(reloaded.blocks.at(-1).data.rows, [['項目', '内容'], ['水質', '淡水']]); assert.deepEqual(reloaded.blocks.at(-1).data.source_ids, ['S1']);
  assert.deepEqual(blockSourceIds(reloaded.blocks[at].data, sources), ['S1'], 'the picker shows the saved choice after reload');
});
