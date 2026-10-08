"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  const [aiResult, setAiResult] = useState(null);
  const [aiLength, setAiLength] = useState("standard");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const effective = aiResult ? { ...generated, ...aiResult } : generated;

  useEffect(() => {
    setAiResult(null);
    setAiMessage("");
  }, [source]);
  const [imageUrl, setImageUrl] = useState("");
  const [noteUrl, setNoteUrl] = useState("");
  const [status, setStatus] = useState("draft");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [copied, setCopied] = useState("");
  const slug = newspaperSlug(source);

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading || busy) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setUploadMessage("JPG・PNG・WebPの画像を選んでください。"); return;
    }
    if (!file.size || file.size > 4 * 1024 * 1024) {
      setUploadMessage("画像は4MB以下にしてください。"); return;
    }
    setUploading(true); setUploadMessage("アップロード中…");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/admin/newspapers/upload", { method: "POST", body: form, signal: AbortSignal.timeout(60000) });
      if (response.status === 401) throw new Error("ログインの有効期限が切れました。管理画面に再ログインしてください。");
      if (response.status === 413) throw new Error("画像が大きすぎます。4MB以下にしてください。");
      const json = await response.json();
      if (!response.ok || !json.url) throw new Error(json.error || "アップロードに失敗しました。");
      setImageUrl(json.url);
      setUploadMessage("画像URLを入力しました。最後に「保存する」または「サイトに公開」を押してください。");
    } catch (error) {
      setUploadMessage(error.name === "TimeoutError" ? "時間がかかっています。通信状態を確認して再度お試しください。" : error.message || "アップロードに失敗しました。");
    } finally { setUploading(false); }
  }

  const characterMeta = {
    ichika: { name: "一果", editor: "ICHIKA AI EDITOR" },
    hatsune: { name: "初音", editor: "HATSUNE AI EDITOR" },
    kiina: { name: "キイナ", editor: "KIINA AI EDITOR" },
  }[character] || { name: "新聞", editor: "AI EDITOR" };

  async function generateAiArticle() {
    if (aiBusy || busy || uploading) return;
    setAiBusy(true);
    setAiMessage(characterMeta.name + "の記事をAI編集部が作成しています…");
    try {
      const response = await fetch("/api/admin/newspapers/ai-write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character,
          source,
          sourcePayload: value,
          draft: generated,
          length: aiLength,
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (response.status === 401) {
        location.href = "/admin/sync/login";
        return;
      }
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "AI記事生成に失敗しました。");
      setAiResult(json.result);
      setAiMessage("AI記事を生成しました。内容を確認・編集してから保存または公開してください。");
    } catch (error) {
      setAiMessage(error.name === "TimeoutError" ? "AI生成に時間がかかっています。もう一度お試しください。" : error.message || "AI記事生成に失敗しました。");
    } finally {
      setAiBusy(false);
    }
  }

  async function copy(text, key) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1400);
  }

  async function save() {
    if (uploading || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/newspapers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...source, ...effective, imageUrl, noteUrl, status, sourcePayload: value }) });
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
      <div className={styles.imageUpload}>
        <label>スマホ・PCから新聞画像を選択<input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} disabled={uploading || busy} /></label>
        <p>推奨：1080×1920px（縦長9:16）。JPG・PNG・WebP、4MB以下。異なる縦横比もそのまま掲載できます。</p>
        <p>選択するとアップロードされ、画像URLが自動入力されます。</p>
        <p role="status" aria-live="polite">{uploadMessage}</p>
        {/^https?:\/\//i.test(imageUrl) && <Image className={styles.imagePreview} src={imageUrl} alt="新聞画像のプレビュー" width={1080} height={1920} unoptimized />}
      </div>
      <label>新聞画像URL<input value={imageUrl} disabled={uploading || busy} onChange={(e) => setImageUrl(e.target.value)} placeholder="画像を選択すると自動入力されます" /></label>
      <label>公開したnote URL<input value={noteUrl} onChange={(e) => setNoteUrl(e.target.value)} placeholder="https://note.com/..." /></label>
      <label>サイト状態<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="draft">下書き</option><option value="published">公開</option><option value="archived">アーカイブ</option></select></label>
      <button type="button" onClick={save} disabled={busy || uploading}>{uploading ? "画像アップロード中…" : busy ? "保存中…" : status === "published" ? "サイトに公開" : "保存する"}</button>
    </div>
    {message && <p className={styles.message}>{message}</p>}
    <section className={styles.aiWriter}>
      <div className={styles.aiWriterCopy}>
        <span>{characterMeta.editor}</span>
        <h3>AIで{characterMeta.name}の記事を詳しくする</h3>
        <p>入力済みの数値・コメントだけを根拠に、{characterMeta.name}本人の文体でサイト記事とnote記事を編集します。入力にない事実は追加しません。</p>
      </div>
      <div className={styles.aiWriterControls}>
        <label>記事の長さ
          <select value={aiLength} onChange={(e) => setAiLength(e.target.value)} disabled={aiBusy}>
            <option value="short">短め</option>
            <option value="standard">標準</option>
            <option value="detailed">詳細</option>
          </select>
        </label>
        <button type="button" onClick={generateAiArticle} disabled={aiBusy || busy || uploading}>
          {aiBusy ? "AI生成中…" : aiResult ? "AIで再生成" : "AIで記事を詳しくする"}
        </button>
        {aiResult && <button type="button" className={styles.aiReset} onClick={() => { setAiResult(null); setAiMessage("テンプレート原稿に戻しました。"); }}>テンプレートに戻す</button>}
      </div>
      {aiMessage && <p className={styles.aiMessage}>{aiMessage}</p>}
      {aiResult && <div className={styles.aiSummary}>
        <b>サイト用要約</b>
        <textarea rows={4} value={effective.summary || ""} onChange={(e) => setAiResult((prev) => ({ ...prev, summary: e.target.value }))} />
      </div>}
    </section>
    <div className={styles.outputs}>
      <article><header><b>サイト記事</b><button onClick={() => copy(effective.articleBody, "site")}>{copied === "site" ? "コピー済み" : "コピー"}</button></header><strong>{generated.title}</strong><textarea readOnly={!aiResult} value={effective.articleBody} onChange={(e) => aiResult && setAiResult((prev) => ({ ...prev, articleBody: e.target.value }))} rows={16} /></article>
      <article><header><b>note記事</b><button onClick={() => copy(`${effective.noteTitle}\n\n${effective.noteBody}`, "note")}>{copied === "note" ? "コピー済み" : "コピー"}</button></header><strong>{effective.noteTitle}</strong><textarea readOnly={!aiResult} value={effective.noteBody} onChange={(e) => aiResult && setAiResult((prev) => ({ ...prev, noteBody: e.target.value }))} rows={12} /></article>
      <article><header><b>X投稿</b><button onClick={() => copy(generated.xPost, "x")}>{copied === "x" ? "コピー済み" : "コピー"}</button></header><textarea readOnly value={generated.xPost} rows={7} /><small>{Array.from(generated.xPost).length}文字</small></article>
      <article><header><b>Shorts台本</b><button onClick={() => copy(generated.shortsScript, "shorts")}>{copied === "shorts" ? "コピー済み" : "コピー"}</button></header><textarea readOnly value={generated.shortsScript} rows={8} /></article>
    </div>
  </section>;
}
