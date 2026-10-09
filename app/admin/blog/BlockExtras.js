'use client';
import { listItems, tableRows, tableWidth, blockSourceIds, setBlockSources, emptyItems, emptyCells, raggedRows, LIST_MAX_ITEMS, TABLE_MAX_ROWS, TABLE_MAX_COLUMNS } from '../../../lib/blog/blockEdits.mjs';
import s from './blogAdmin.module.css';
import x from './blockExtras.module.css';

const jst = v => new Date(v).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

// Values from older or hand-made documents are shown as text, so an odd entry can be corrected instead of breaking the editor.
const asItems = value => (Array.isArray(value) ? value.map(v => String(v ?? '')) : []);
const asRows = value => (Array.isArray(value) && value.length ? value.map(r => (Array.isArray(r) ? r.map(v => String(v ?? '')) : [String(r ?? '')])) : [['']]);

// One input per list item. Empty items are saved as they are, so the editor points them out and offers to remove them.
export function ListEditor({ data, onData }) {
  const items = asItems(data.items);
  const set = next => onData({ ...data, items: next });
  return <>
    <ol className={x.items} aria-label="リストの項目">{items.map((item, i) => <li className={x.item} key={i}>
      <textarea rows={2} value={item} maxLength={500} aria-label={`項目${i + 1}`} onChange={e => set(listItems.set(items, i, e.target.value))} />
      <button type="button" aria-label={`項目${i + 1}を上へ`} disabled={i === 0} onClick={() => set(listItems.move(items, i, -1))}>↑</button>
      <button type="button" aria-label={`項目${i + 1}を下へ`} disabled={i === items.length - 1} onClick={() => set(listItems.move(items, i, 1))}>↓</button>
      <button type="button" aria-label={`項目${i + 1}を削除`} onClick={() => set(listItems.remove(items, i))}>×</button>
    </li>)}</ol>
    <div className={x.tools}><button type="button" disabled={items.length >= LIST_MAX_ITEMS} onClick={() => set(listItems.add(items))}>＋ 項目を追加</button></div>
    {!items.length ? <p className={x.note}>項目がありません。項目を追加するか、このブロックを削除してください。</p> : null}
    {emptyItems(items) ? <><p className={x.note}>空の項目があります。そのまま公開すると空の行になるため、入力するか削除してください。</p>
      <div className={x.tools}><button type="button" onClick={() => set(listItems.compact(items))}>空の項目を削除</button></div></> : null}
  </>;
}

// Cell-by-cell table editing that always keeps the table rectangular.
export function TableEditor({ data, onData }) {
  const rows = asRows(data.rows);
  const width = tableWidth(rows), header = data.header !== false;
  const set = next => onData({ ...data, rows: next });
  return <>
    <label className={s.field}>表のタイトル（任意）<input value={data.caption || ''} maxLength={200} onChange={e => onData({ ...data, caption: e.target.value })} /></label>
    <div className={s.multi}><label><input type="checkbox" checked={header} onChange={e => onData({ ...data, header: e.target.checked })} />1行目を見出しにする</label></div>
    <div className={x.tableWrap}><table className={x.table}><tbody>{rows.map((row, r) => <tr key={r}>
      {Array.from({ length: width }, (_, c) => <td key={c}><input value={row[c] ?? ''} maxLength={200} data-header={header && r === 0}
        aria-label={`${r + 1}行${c + 1}列`} onChange={e => set(tableRows.setCell(rows, r, c, e.target.value))} /></td>)}
      <td><div className={x.cellTools}>
        <button type="button" aria-label={`${r + 1}行目を上へ`} disabled={r === 0} onClick={() => set(tableRows.moveRow(rows, r, -1))}>↑</button>
        <button type="button" aria-label={`${r + 1}行目を下へ`} disabled={r === rows.length - 1} onClick={() => set(tableRows.moveRow(rows, r, 1))}>↓</button>
        <button type="button" aria-label={`${r + 1}行目を削除`} disabled={rows.length <= 1} onClick={() => set(tableRows.removeRow(rows, r))}>×</button>
      </div></td>
    </tr>)}</tbody></table></div>
    <div className={x.tools}>
      <button type="button" disabled={rows.length >= TABLE_MAX_ROWS} onClick={() => set(tableRows.addRow(rows))}>＋ 行を追加</button>
      <button type="button" disabled={width >= TABLE_MAX_COLUMNS} onClick={() => set(tableRows.addColumn(rows))}>＋ 列を追加</button>
      <button type="button" disabled={width <= 1} onClick={() => set(tableRows.removeColumn(rows, width - 1))}>最後の列を削除</button>
    </div>
    {raggedRows(rows) ? <><p className={x.note}>列数のそろっていない行があります。「列数をそろえる」で足りないセルを空欄で補います。</p>
      <div className={x.tools}><button type="button" onClick={() => set(tableRows.normalize(rows))}>列数をそろえる</button></div></> : null}
    {emptyCells(rows) ? <><p className={x.note}>空のセルがあります。そのまま公開すると空欄になるため、入力するか、行・列を削除してください。</p>
      {rows.some(r => !r.some(v => v.trim())) ? <div className={x.tools}><button type="button" onClick={() => set(tableRows.dropEmptyRows(rows))}>空の行を削除</button></div> : null}</> : null}
  </>;
}

// Citation for one block, chosen only from the sources registered for this AI draft. The check results above
// (AI下書きの確認) are recomputed after each save.
export function SourcePicker({ data, sources, onData }) {
  const selected = blockSourceIds(data, sources);
  const unknown = (Array.isArray(data.source_ids) ? data.source_ids : []).filter(id => !sources.some(src => src.id === id));
  const toggle = (id, on) => onData(setBlockSources(data, on ? [...selected, id] : selected.filter(v => v !== id), sources));
  return <fieldset className={x.sources}><legend>このブロックの出典</legend>
    {sources.map(src => <label className={x.source} key={src.id}>
      <input type="checkbox" checked={selected.includes(src.id)} onChange={e => toggle(src.id, e.target.checked)} />
      <span>{src.id}：{src.label}<small>{src.fetched_at ? `取得 ${jst(src.fetched_at)}` : src.period ? `取得日時の記録なし（集計期間 ${src.period}）` : '取得日時の記録なし（収録データ）'}</small></span>
    </label>)}
    {unknown.length ? <p className={x.note} role="alert">この記事に登録されていない出典ID「{unknown.join('・')}」が設定されているため、保存できません。<button type="button" onClick={() => onData(setBlockSources(data, selected, sources))}>登録済みの出典だけにする</button></p> : null}
    <p className={x.note}>{selected.length ? `出典：${selected.join('・')}。` : '出典なし。'}数値・日付は、選んだ出典にあるものだけ確認を通過します。保存後に「AI下書きの確認」で結果を確認してください。</p>
  </fieldset>;
}

export function HeadingSourceNote() {
  return <p className={x.note}>見出しには出典を付けません。見出しの数値・日付は、同じ見出しの下にある出典付きブロックに同じ値があるときだけ確認を通過します。</p>;
}
