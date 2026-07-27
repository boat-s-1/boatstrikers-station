"use client";

import { useEffect, useState } from "react";
import styles from "./note.module.css";

const courses = ["桐生","戸田","江戸川","平和島","多摩川","浜名湖","蒲郡","常滑","津","三国","びわこ","住之江","尼崎","鳴門","丸亀","児島","宮島","徳山","下関","若松","芦屋","福岡","唐津","大村"];
const today = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());

const empty = {
  race_date: today,
  course_code: 1,
  race_no: 1,
  character_name: "一果",
  feature_title: "一果の徹底解説を公開中",
  teaser_text: "本命理由・危険ポイント・展開予想・買い目を詳しく解説しています。",
  note_url: "",
  target_timing: "both",
  is_paid: false,
  cta_label: "",
  is_published: false,
  is_pickup: false,
  sort_order: 100,
};

export default function NoteFeatureAdmin() {
  const [form, setForm] = useState(empty);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(date = form.race_date) {
    const response = await fetch(`/api/admin/note-features?date=${date}`, { cache: "no-store" });
    if (response.status === 401) { location.href = "/admin/sync/login"; return; }
    const json = await response.json();
    setItems(json.items || []);
  }

  useEffect(() => { load(form.race_date); }, []);

  function change(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin/note-features", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await response.json();
    setBusy(false);
    setMessage(response.ok ? "保存しました。" : json.error || "保存に失敗しました。");
    if (response.ok) load();
  }

  function edit(item) {
    setForm({ ...empty, ...item, target_timing: item.target_timing || "both" });
    scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id) {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/admin/note-features?id=${id}`, { method: "DELETE" });
    load();
  }

  return <>
    <header className={styles.header}>
      <div><span>ULTIMATE v13.0</span><h1>note連携 管理</h1><p>noteがあるレースは印まで公開し、実際の買い目をnoteへ切り替えます。</p></div>
      <a href="/admin/sync">同期管理へ</a>
    </header>

    <form className={styles.form} onSubmit={save}>
      <div className={styles.grid}>
        <label>開催日<input type="date" name="race_date" value={form.race_date} onChange={(e) => { change(e); setTimeout(() => load(e.target.value), 0); }} required /></label>
        <label>場<select name="course_code" value={form.course_code} onChange={change}>{courses.map((name,index)=><option value={index+1} key={name}>{String(index+1).padStart(2,"0")} {name}</option>)}</select></label>
        <label>レース<select name="race_no" value={form.race_no} onChange={change}>{Array.from({length:12},(_,index)=><option value={index+1} key={index}>{index+1}R</option>)}</select></label>
        <label>担当<input name="character_name" value={form.character_name} onChange={change} /></label>
      </div>

      <div className={styles.gridTwo}>
        <label>表示対象<select name="target_timing" value={form.target_timing || "both"} onChange={change}><option value="both">前日版・直前版の両方</option><option value="previous">前日版のみ</option><option value="live">直前版のみ</option></select></label>
        <label>ボタン文言<input name="cta_label" value={form.cta_label || ""} onChange={change} placeholder="空欄なら自動設定" /></label>
      </div>

      <label>見出し<input name="feature_title" value={form.feature_title} onChange={change} /></label>
      <label>紹介文<textarea name="teaser_text" value={form.teaser_text || ""} onChange={change} rows="3" /></label>
      <label>note URL<input type="url" name="note_url" placeholder="https://note.com/..." value={form.note_url || ""} onChange={change} /></label>

      <div className={styles.checks}>
        <label><input type="checkbox" name="is_published" checked={!!form.is_published} onChange={change} /> 詳細版を公開</label>
        <label><input type="checkbox" name="is_paid" checked={!!form.is_paid} onChange={change} /> 有料note</label>
        <label><input type="checkbox" name="is_pickup" checked={!!form.is_pickup} onChange={change} /> 今日のPICK UP</label>
      </div>

      <div className={styles.actions}>
        <button disabled={busy}>{busy ? "保存中..." : "保存する"}</button>
        <button type="button" className={styles.sub} onClick={() => setForm({ ...empty, race_date: form.race_date })}>新規入力</button>
        <span>{message}</span>
      </div>
    </form>

    <section className={styles.list}>
      <h2>{form.race_date} の登録レース</h2>
      {items.length === 0 ? <p>登録はありません。</p> : items.map((item) => <article key={item.id}>
        <div><b>{courses[item.course_code-1]} {item.race_no}R</b><span>{item.is_published ? "公開中" : "非公開"}{item.is_paid ? "・有料" : "・無料"}{item.is_pickup ? "・PICK UP" : ""}</span><small>{item.target_timing || "both"}｜{item.feature_title}</small></div>
        <div><button onClick={() => edit(item)}>編集</button><button onClick={() => remove(item.id)}>削除</button></div>
      </article>)}
    </section>
  </>;
}
