"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buildNewspaperChannels, newspaperSlug } from "../../../lib/newspaperContent";
import styles from "./newspaperPublishingPanel.module.css";

function inputFor(character, value) {
  const common = { character, date: value.date, course: value.course, raceNo: value.raceNo, edition: value.edition };
  if (character === "ichika") return { ...common, headline: value.mainCopy, primaryLabel: "イン逃げ率", primaryValue: value.escapeRate ? `${value.escapeRate}%` : "", comment: value.ichikaComment, details: [value.nationalAverage ? `全国平均 ${value.nationalAverage}%` : "", value.honmeiBoat ? `本命 ${value.honmeiBoat}号艇` : "", value.honmeiComment] };
  if (character === "hatsune") return { ...common, headline: value.headline, primaryLabel: "女子戦期待度", primaryValue: value.expectation ? `${value.expectation}%` : "", comment: value.comment, details: [value.featuredBoat ? `注目 ${value.featuredBoat}号艇` : "", ...(value.checkpoints || [])] };
  return { ...common, headline: value.headline, primaryLabel: "穴狙い期待度", primaryValue: value.holeChance ? `${value.holeChance}%` : "", comment: value.kiinaComment, details: [value.holeBoat ? `注目穴 ${value.holeBoat}号艇` : "", value.callout] };
}

export default function NewspaperPublishingPanel({ character, value }) {
  const source = useMemo(() => inputFor(character, value), [character, value]);
  const generated = useMemo(() => buildNewspaperChannels(source), [source]);
  const [imageUrl, setImageUrl] = useState("");
  const [noteUrl, setNoteUrl] = useState("");
  const [status, setStatus] = useState("draft");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const slug = newspaperSlug(source);

  async function copy(text, key) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1400);
  }

  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/newspapers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...source, ...generated, imageUrl, noteUrl, status, sourcePayload: value }) });
      if (response.status === 401) { location.href = "/admin/sync/login"; return; }
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "保存に失敗しました");
      setMessage(status === "published" ? "サイトに公開しました。" : "下書きを保存しました。");
    } catch (error) { setMessage(error.message || "保存に失敗しました"); }
    finally { setBusy(false); }
  }

  return <section className={styles.panel}>
    <div className={styles.head}><div><span>SITE / NOTE / SOCIAL</span><h2>記事・投稿原稿</h2><p>新聞と同じ入力から各媒体向けの原稿を生成します。</p></div><Link href={`/newspapers/${slug}`} target="_blank">詳細ページ確認</Link></div>
    <div className={styles.publishGrid}>
      <label>新聞画像URL<input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></label>
      <label>公開したnote URL<input value={noteUrl} onChange={(e) => setNoteUrl(e.target.value)} placeholder="https://note.com/..." /></label>
      <label>サイト状態<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="draft">下書き</option><option value="published">公開</option><option value="archived">アーカイブ</option></select></label>
      <button type="button" onClick={save} disabled={busy}>{busy ? "保存中…" : status === "published" ? "サイトに公開" : "保存する"}</button>
    </div>
    {message && <p className={styles.message}>{message}</p>}
    <div className={styles.outputs}>
      <article><header><b>サイト記事</b><button onClick={() => copy(generated.articleBody, "site")}>{copied === "site" ? "コピー済み" : "コピー"}</button></header><strong>{generated.title}</strong><textarea readOnly value={generated.articleBody} rows={10} /></article>
      <article><header><b>note記事</b><button onClick={() => copy(`${generated.noteTitle}\n\n${generated.noteBody}`, "note")}>{copied === "note" ? "コピー済み" : "コピー"}</button></header><strong>{generated.noteTitle}</strong><textarea readOnly value={generated.noteBody} rows={12} /></article>
      <article><header><b>X投稿</b><button onClick={() => copy(generated.xPost, "x")}>{copied === "x" ? "コピー済み" : "コピー"}</button></header><textarea readOnly value={generated.xPost} rows={7} /><small>{Array.from(generated.xPost).length}文字</small></article>
      <article><header><b>Shorts台本</b><button onClick={() => copy(generated.shortsScript, "shorts")}>{copied === "shorts" ? "コピー済み" : "コピー"}</button></header><textarea readOnly value={generated.shortsScript} rows={8} /></article>
    </div>
  </section>;
}
