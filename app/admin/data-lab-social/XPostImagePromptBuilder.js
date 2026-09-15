"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

const MODES = [
  { key: "common", label: "共通コンパクト" },
  { key: "ichika", label: "一果コンパクト" },
  { key: "hatsune", label: "初音コンパクト" },
  { key: "kiina", label: "キイナコンパクト" },
];

function statsMap(payload) {
  const map = {};
  const stats = Array.isArray(payload?.stats) ? payload.stats : [];
  stats.forEach((s) => { map[String(s.label || "")] = String(s.value || ""); });
  return map;
}
function detail(payload, key) {
  const d = payload?.character_details || {};
  return d?.[key] && typeof d[key] === "object" ? d[key] : {};
}
function text(v) { return v === null || v === undefined || v === "" ? "該当なし" : String(v); }
function list(v, limit = 3) {
  if (!Array.isArray(v) || !v.length) return "該当なし";
  return v.slice(0, limit).map((r, i) => {
    if (!r || typeof r !== "object") return `${i + 1}. ${String(r)}`;
    const venue = r.venue || r.course_name || "";
    const race = r.race_no ? `${r.race_no}R` : "";
    const rate = Number.isFinite(Number(r.rate)) ? `${Number(r.rate).toFixed(1)}%` : "";
    const count = r.count !== undefined ? `${r.count}R` : "";
    const trifecta = r.trifecta || "";
    const payout = Number(r.payout || r.max_payout || 0) > 0 ? `${Number(r.payout || r.max_payout).toLocaleString("ja-JP")}円` : "";
    return `${i + 1}. ${[venue, race, trifecta, rate, count, payout].filter(Boolean).join(" ")}`;
  }).join("\n");
}
function topText(payload) {
  const top = payload?.max_payout;
  if (!top) return "該当なし";
  return `${top.venue || ""}${top.race_no || ""}R ${top.trifecta || ""} / ${Number(top.payout || 0).toLocaleString("ja-JP")}円`;
}
function rankingLines(payload) {
  const a = Array.isArray(payload?.venue_manshu_ranking) ? payload.venue_manshu_ranking : [];
  if (!a.length) return "該当なし";
  return a.slice(0, 3).map((r, i) => `${i + 1}. ${r.venue || ""} ${r.count || 0}本`).join("\n");
}

const RULES = `【共通ルール】
・横長16:9、1200×675px。Xのスマホタイムラインで一瞬で読めるコンパクト画像
・濃紺・ダークブルー・白・ゴールドのBoatStrikers DATA LAB世界観
・確定データだけを使用し、数値・場名・出目・配当を推測しない
・「該当なし」の項目は見出し・カード・ランキング枠ごと削除する
・空欄カードや空の順位枠を絶対に作らない。削除したスペースは残った数字・メモ・キャラクターを拡大して自然に詰める
・[object Object]を絶対に表示しない
・「事故・異常者」「異常者」「事故・異常着」は使用せず「事故レース」と表記
・文字量を抑え、主要数字は3〜5項目程度を大きく表示
・下部に BoatStrikers / boat-strike.online`;

function buildPrompt(payload, mode) {
  const s = statsMap(payload), date = payload?.date || "";
  const i = detail(payload, "ichika"), h = detail(payload, "hatsune"), k = detail(payload, "kiina");
  const escape = s["逃げ"] || "該当なし";
  const rate = escape.match(/\(([^)]+)\)/)?.[1] || "該当なし";

  if (mode === "ichika") return `BoatStrikers DATA LABのX投稿専用【一果・横長コンパクト画像】を作成してください。\n${RULES}\n・一果だけを配置。緑アクセント。テーマ「イン逃げで昨日を読む」\n・万舟や最高配当は主役にせず、イン逃げの結果を中心にする\n\n【確定データ｜${date}】\n1号艇1着：${s["1号艇1着"] || s["1号艇1着数"] || "該当なし"}\n逃げ：${escape}\n逃げ率：${rate}\nイン逃げ成功数：${text(i.escape_success_count)}\nイン崩れ数：${text(i.escape_failure_count)}\nイン逃げが強かった場：\n${list(i.strong_venues)}\nイン崩れ注目レース：\n${list(i.upset_races)}\n一果メモ：${text(i.comment)}\n\n左〜中央に主要数字、右側に一果。ランキングデータがなければランキング領域自体を消す。`;

  if (mode === "hatsune") return `BoatStrikers DATA LABのX投稿専用【初音・横長コンパクト画像】を作成してください。\n${RULES}\n・初音だけを配置。紫・ピンクアクセント。テーマ「昨日の女子戦だけを見る」\n・全体集計を女子戦値として流用しない。女子戦専用データだけを使う\n\n【確定データ｜${date}】\n女子戦数：${text(h.race_count)}\n女子戦1号艇1着：${text(h.boat1_wins)}\n女子戦逃げ数：${text(h.escape_wins)}\n女子戦逃げ率：${text(h.escape_rate)}\n女子戦万舟数：${text(h.manshu_count)}\n女子戦最高配当：${text(h.max_payout)}\n荒れた女子戦：\n${list(h.upset_races)}\n注目女子戦：\n${list(h.featured_races)}\n初音メモ：${text(h.comment)}\n\n左〜中央に女子戦の主要数字、右側に初音。データがない項目はカードごと削除する。`;

  if (mode === "kiina") return `BoatStrikers DATA LABのX投稿専用【キイナ・横長コンパクト画像】を作成してください。\n${RULES}\n・キイナだけを配置。黄色・ゴールドアクセント。テーマ「昨日の穴と高配当を見る」\n・逃げや堅い決着は主役にせず、万舟・高配当・外枠頭を中心にする\n\n【確定データ｜${date}】\n万舟：${s["万舟"] || "該当なし"}\n万舟率：${s["万舟率"] || "該当なし"}\n最高配当：${topText(payload)}\n5号艇1着：${s["5号艇1着"] || s["5号艇1着数"] || "該当なし"}\n4〜6号艇頭の高配当件数：${text(k.outer_head_high_payout_count)}\n荒れた場：\n${list(k.upset_venues)}\n高配当レース：\n${list(k.high_payout_races, 5)}\nキイナメモ：${text(k.comment)}\n\n左〜中央に穴・高配当の主要数字、右側にキイナ。最高配当がある場合は最も強く見せる。`;

  return `BoatStrikers DATA LABのX投稿専用【共通・横長コンパクト画像】を作成してください。\n${RULES}\n・一果・初音・キイナの3人を右側に小さく配置\n\n【確定データ｜${date}】\n開催：${s["開催"] || s["開催数"] || "該当なし"}\n万舟：${s["万舟"] || "該当なし"}\n万舟率：${s["万舟率"] || "該当なし"}\n1号艇1着：${s["1号艇1着"] || s["1号艇1着数"] || "該当なし"}\n5号艇1着：${s["5号艇1着"] || s["5号艇1着数"] || "該当なし"}\n逃げ：${escape}\n最高配当：${topText(payload)}\n事故レース：${payload?.incident_races ?? 0}R\n優勝戦・DR：${payload?.featured_races ?? 0}R\n万舟が多かった場TOP3：\n${rankingLines(payload)}\n\n左〜中央にその日の最重要数字3〜5個、右側に3人。全項目を無理に載せず読みやすさを優先する。`;
}

export default function XPostImagePromptBuilder({ payload }) {
  const [mode, setMode] = useState("common");
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(() => buildPrompt(payload || {}, mode), [payload, mode]);
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { setCopied(false); }
  }
  return <section className={styles.promptBuilder}>
    <div className={styles.promptHeader}><div><span className={styles.promptEyebrow}>X POST IMAGE BUILDER</span><h3>X投稿専用・横長コンパクト画像</h3></div></div>
    <p className={styles.promptDescription}>共通・一果・初音・キイナを切り替えて、キャラ別の16:9横長画像プロンプトを生成できます。</p>
    <div className={styles.presetGrid}>{MODES.map(m => <button key={m.key} type="button" className={`${styles.presetButton} ${mode === m.key ? styles.active : ""}`} onClick={() => setMode(m.key)}>{m.label}</button>)}</div>
    <textarea className={styles.promptTextarea} readOnly value={prompt} />
    <button className={styles.promptCopyButton} type="button" onClick={copyPrompt}>{copied ? "コピーしました ✓" : `${MODES.find(m => m.key === mode)?.label || "X横長"}をコピー`}</button>
  </section>;
}
