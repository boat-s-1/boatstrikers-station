"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./resultsAdmin.module.css";

const EMPTY = {
  race_date: "",
  place: "",
  race_no: "",
  category: "一果",
  bet_text: "",
  invest: "",
  payout: "",
  hit: false,
  memo: "",
  hit_image_url: "",
  hit_title: "",
  hit_note: "",
};

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export default function ResultsAdminClient() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ ...EMPTY, race_date: todayJst() });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/results", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "取得に失敗しました");
      setRows(body.results || []);
    } catch (e) { setMessage(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibleRows = useMemo(() => filter === "all" ? rows : rows.filter(r => r.category === filter), [rows, filter]);

  function change(name, value) { setForm(prev => ({ ...prev, [name]: value })); }
  function reset() { setEditingId(null); setForm({ ...EMPTY, race_date: todayJst() }); setPreviewUrl(""); setMessage(""); }

  function edit(row) {
    setEditingId(row.id);
    setForm({
      race_date: row.race_date || "", place: row.place || "", race_no: row.race_no ?? "",
      category: row.category || "一果", bet_text: row.bet_text || "",
      invest: row.invest ?? "", payout: row.payout ?? "", hit: Boolean(row.hit), memo: row.memo || "",
      hit_image_url: row.hit_image_url || "", hit_title: row.hit_title || "", hit_note: row.hit_note || "",
    });
    setPreviewUrl(row.hit_image_url || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }


  async function uploadImage(file) {
    if (!file) return;
    setUploading(true); setMessage("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/results/upload", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "画像アップロードに失敗しました");
      change("hit_image_url", body.url);
      setPreviewUrl(body.url);
      setMessage("画像をアップロードしました。実績を登録すると保存されます。");
    } catch (e) { setMessage(e.message); }
    finally { setUploading(false); }
  }

  async function submit(e) {
    e.preventDefault(); setSaving(true); setMessage("");
    try {
      const url = editingId ? `/api/admin/results/${editingId}` : "/api/admin/results";
      const res = await fetch(url, { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "保存に失敗しました");
      setMessage(editingId ? "実績を更新しました。" : "実績を登録しました。");
      reset(); await load();
    } catch (e) { setMessage(e.message); }
    finally { setSaving(false); }
  }

  async function remove(id) {
    if (!window.confirm("この実績を削除しますか？")) return;
    const res = await fetch(`/api/admin/results/${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) { setMessage(body.error || "削除に失敗しました"); return; }
    if (editingId === id) reset();
    setMessage("削除しました。"); await load();
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span>BOATSTRIKERS CMS</span><h1>予想実績管理</h1><p>一果・初音・キイナの予想、投資、払戻、的中画像を登録します。</p></div>
      <div className={styles.headerLinks}><a href="/admin">管理画面一覧</a><a href="/">トップページ</a></div>
    </header>

    <form className={styles.formCard} onSubmit={submit}>
      <div className={styles.formTitle}><h2>{editingId ? "実績を編集" : "実績を新規登録"}</h2>{editingId && <button type="button" onClick={reset}>新規登録へ戻る</button>}</div>
      <div className={styles.grid}>
        <label><span>日付 *</span><input type="date" required value={form.race_date} onChange={e => change("race_date", e.target.value)} /></label>
        <label><span>担当 *</span><select value={form.category} onChange={e => change("category", e.target.value)}><option>一果</option><option>初音</option><option>キイナ</option></select></label>
        <label><span>場名 *</span><input required placeholder="例：桐生" value={form.place} onChange={e => change("place", e.target.value)} /></label>
        <label><span>レース番号 *</span><input required type="number" min="1" max="12" placeholder="1～12" value={form.race_no} onChange={e => change("race_no", e.target.value)} /></label>
        <label className={styles.wide}><span>買い目</span><input placeholder="例：1-234-234" value={form.bet_text} onChange={e => change("bet_text", e.target.value)} /></label>
        <label><span>投資額</span><input type="number" min="0" value={form.invest} onChange={e => change("invest", e.target.value)} /></label>
        <label><span>払戻額</span><input type="number" min="0" value={form.payout} onChange={e => change("payout", e.target.value)} /></label>
        <label className={styles.check}><input type="checkbox" checked={form.hit} onChange={e => change("hit", e.target.checked)} /><span>的中として登録</span></label>
        <label className={styles.wide}><span>メモ</span><textarea rows="3" value={form.memo} onChange={e => change("memo", e.target.value)} /></label>
        <div className={`${styles.wide} ${styles.imageUploadBox}`}>
          <div className={styles.imageUploadHead}>
            <div><span className={styles.fieldLabel}>的中画像</span><small>JPG / PNG / WebP・8MB以下</small></div>
            {form.hit_image_url && <button type="button" className={styles.clearImage} onClick={() => { change("hit_image_url", ""); setPreviewUrl(""); }}>画像を外す</button>}
          </div>
          <label className={styles.uploadButton}>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => uploadImage(e.target.files?.[0])} disabled={uploading} />
            <span>{uploading ? "アップロード中…" : "画像を選んでアップロード"}</span>
          </label>
          {(previewUrl || form.hit_image_url) && <div className={styles.imagePreview}><img src={previewUrl || form.hit_image_url} alt="的中画像プレビュー" /></div>}
          <details className={styles.urlDetails}>
            <summary>URLを直接入力する場合</summary>
            <input type="url" placeholder="https://..." value={form.hit_image_url} onChange={e => { change("hit_image_url", e.target.value); setPreviewUrl(e.target.value); }} />
          </details>
        </div>
        <label><span>的中画像タイトル</span><input value={form.hit_title} onChange={e => change("hit_title", e.target.value)} /></label>
        <label><span>的中画像コメント</span><input value={form.hit_note} onChange={e => change("hit_note", e.target.value)} /></label>
      </div>
      <button className={styles.save} disabled={saving}>{saving ? "保存中…" : editingId ? "変更を保存" : "実績を登録"}</button>
      {message && <p className={styles.message}>{message}</p>}
    </form>

    <section className={styles.listCard}>
      <div className={styles.listHead}><div><h2>登録済み実績</h2><p>{visibleRows.length}件</p></div><select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">全担当</option><option>一果</option><option>初音</option><option>キイナ</option></select></div>
      {loading ? <p className={styles.empty}>読み込み中…</p> : visibleRows.length === 0 ? <p className={styles.empty}>登録された実績はありません。</p> : <div className={styles.tableWrap}><table><thead><tr><th>日付</th><th>担当</th><th>レース</th><th>投資</th><th>払戻</th><th>結果</th><th>操作</th></tr></thead><tbody>{visibleRows.map(row => <tr key={row.id}><td>{row.race_date}</td><td>{row.category}</td><td>{row.place} {row.race_no}R<br/><small>{row.bet_text || "—"}</small></td><td>{Number(row.invest || 0).toLocaleString()}円</td><td>{Number(row.payout || 0).toLocaleString()}円</td><td><span className={row.hit || Number(row.payout) > 0 ? styles.hit : styles.miss}>{row.hit || Number(row.payout) > 0 ? "的中" : "不的中"}</span></td><td><div className={styles.actions}><button type="button" onClick={() => edit(row)}>編集</button><button type="button" className={styles.delete} onClick={() => remove(row.id)}>削除</button></div></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
