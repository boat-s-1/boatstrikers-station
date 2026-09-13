"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const PRESETS = [
  { key: "three", label: "3人入り固定テンプレ", tone: "一果・初音・キイナを上部に配置し、管理画面の数値を固定座標へ流し込むBoatStrikers標準版。" },
  { key: "simple", label: "データ優先版", tone: "キャラクターは入れず、濃紺・白・ゴールドのデータ番組風。数字の読みやすさを最優先。" },
  { key: "luxury", label: "高級感版", tone: "3人は小さめ。濃紺・白・ゴールド中心でプレミアムなスポーツデータ誌の雰囲気。" },
  { key: "anime", label: "キャラ強め版", tone: "3人を少し大きめにし、VTuber番組のような親しみやすさを強める。ただしデータ欄を隠さない。" },
];

const OUTPUT_MODES = [
  { key: "cover", label: "共通表紙 1枚", detail: null },
  { key: "common", label: "共通 2枚", detail: "common" },
  { key: "ichika", label: "一果 2枚", detail: "ichika" },
  { key: "hatsune", label: "初音 2枚", detail: "hatsune" },
  { key: "kiina", label: "キイナ 2枚", detail: "kiina" },
];

function statsMap(payload) {
  const map = {};
  const stats = Array.isArray(payload?.stats) ? payload.stats : [];
  stats.forEach((s) => { map[String(s.label || "")] = String(s.value || ""); });
  return map;
}

function rankingLines(payload) {
  const ranking = Array.isArray(payload?.venue_manshu_ranking) ? payload.venue_manshu_ranking : [];
  if (!ranking.length) return "1. 該当なし 0本";
  return ranking.slice(0, 5).map((r, i) => `${i + 1}. ${r.venue || ""} ${r.count || 0}本`).join("\n");
}

function topText(payload) {
  const top = payload?.max_payout;
  if (!top) return "該当なし";
  return `${top.venue || ""}${top.race_no || ""}R ${top.trifecta || ""} / ${Number(top.payout || 0).toLocaleString("ja-JP")}円`;
}

function buildCoverPrompt(payload, preset) {
  const s = statsMap(payload);
  const title = payload?.title || "昨日のボートレースを数字で見る";
  const headline = payload?.headline || "";
  const date = payload?.date || "";

  return `BoatStrikers DATA LABの9:16縦長SNS画像【1枚目・共通表紙】を作成してください。\n\n【最重要】\n・1080×1920、9:16\n・毎日同じ構成で使う固定テンプレート\n・上部に一果・初音・キイナ、中央〜下部にデータカード\n・数値、場名、出目、配当は下記データから絶対に変更しない\n・文字化け、余計な英語、架空の数値を追加しない\n・濃紺、ダークブルー、白、ゴールドを基本色にする\n・SNSの表紙として、タイトル、最高配当、万舟本数が一目で伝わること\n\n【選択デザイン】\n${preset.label}\n${preset.tone}\n\n【3キャラクター】\n左：一果。深緑系、落ち着いたリーダー感、イン逃げ分析担当。\n中央：初音。紫髪、ピンクのうさ耳フード、女子戦分析担当。\n右：キイナ。黄色〜ゴールド系、元気で攻めた雰囲気、穴狙い分析担当。\nタグは「一果｜イン逃げ分析」「初音｜女子戦分析」「キイナ｜穴狙い分析」。\n\n【表紙レイアウト】\n・BoatStrikers DATA LABロゴ\n・日付：${date}\n・タイトル：${title}\n・強調サマリー：${headline}\n・開催：${s["開催"] || s["開催数"] || ""}\n・万舟：${s["万舟"] || ""}\n・万舟率：${s["万舟率"] || ""}\n・1号艇1着：${s["1号艇1着"] || s["1号艇1着数"] || ""}\n・5号艇1着：${s["5号艇1着"] || s["5号艇1着数"] || ""}\n・逃げ：${s["逃げ"] || ""}\n・最高配当：${topText(payload)}\n・万舟が多かった場TOP5：\n${rankingLines(payload)}\n・事故・異常者：${payload?.incident_races || 0}R\n・優勝戦・DR：${payload?.featured_races || 0}R\n\n【表紙ルール】\n・3人は上部25〜30%以内\n・最高配当カードだけ白〜淡いゴールド背景で強く目立たせる\n・数字は大きく、項目名は小さく\n・最下部に「昨日の結果を、数字で振り返る。」「BoatStrikers」「boat-strike.online」\n・2枚構成で使う場合も1枚目単体で意味が通じる完成度にする。`;
}

function buildDetailPrompt(payload, mode) {
  const s = statsMap(payload);
  const date = payload?.date || "";
  const common = `【使用する実データ】\n日付：${date}\n開催：${s["開催"] || s["開催数"] || ""}\n万舟：${s["万舟"] || ""}\n万舟率：${s["万舟率"] || ""}\n1号艇1着：${s["1号艇1着"] || s["1号艇1着数"] || ""}\n5号艇1着：${s["5号艇1着"] || s["5号艇1着数"] || ""}\n逃げ：${s["逃げ"] || ""}\n最高配当：${topText(payload)}\n万舟TOP5：\n${rankingLines(payload)}\n事故・異常者：${payload?.incident_races || 0}R\n優勝戦・DR：${payload?.featured_races || 0}R`;

  const base = `BoatStrikers DATA LABの9:16縦長SNS画像【2枚目・詳細】を作成してください。\n1080×1920、9:16。1枚目と同じ濃紺・ダークブルー・白・ゴールドの世界観を維持し、数字を最優先で読みやすくしてください。下記にない数値は絶対に追加しないでください。\n\n${common}\n\n`;

  if (mode === "ichika") {
    return `${base}【一果分岐】\n一果を上部または右上に小さく配置。緑アクセント。テーマは「イン逃げ分析」。\n大きく見せる項目は「1号艇1着」「逃げ」「逃げ率」。補助として万舟TOP5、最高配当、事故・異常者を整理。\n見出し例は「一果のイン逃げDATA」。堅実で分析的な雰囲気にする。\n実データから断定できないコメントや架空のイン有利場ランキングは作らない。`;
  }
  if (mode === "hatsune") {
    return `${base}【初音分岐】\n初音を上部または右上に小さく配置。紫アクセント。テーマは「初音のDATA CHECK」。\n現時点の入力データは全体集計なので、女子戦専用の架空数値は絶対に作らない。\n開催、万舟率、1号艇1着、逃げ率、事故・異常者、優勝戦・DRを知的で見やすく整理し、「女子戦専用集計ではない」ことが誤解されない構成にする。`;
  }
  if (mode === "kiina") {
    return `${base}【キイナ分岐】\nキイナを上部または右上に小さく配置。黄色・ゴールドアクセント。テーマは「穴・高配当分析」。\n大きく見せる項目は「万舟」「万舟率」「最高配当」「5号艇1着」。万舟TOP5を大きなランキングカードで表示。\n見出し例は「キイナの穴DATA」。勢いは出すが、数値を煽って改変しない。`;
  }

  return `${base}【共通詳細】\n3人は小さなワンポイントに留める。\n上段に主要数値の再整理、中段に「万舟が多かった場TOP5」と「最高配当」、下段に「事故・異常者」「優勝戦・DR」と短い総括スペース。\n1枚目より情報整理を優先し、保存して見返したくなるデータシート風にする。`;
}

export default function PromptBuilder({ payload }) {
  const [presetKey, setPresetKey] = useState("three");
  const [modeKey, setModeKey] = useState("common");
  const [copiedKey, setCopiedKey] = useState("");

  useEffect(() => {
    try {
      const savedPreset = localStorage.getItem("bs_data_lab_prompt_preset");
      const savedMode = localStorage.getItem("bs_data_lab_output_mode");
      if (savedPreset && PRESETS.some((p) => p.key === savedPreset)) setPresetKey(savedPreset);
      if (savedMode && OUTPUT_MODES.some((m) => m.key === savedMode)) setModeKey(savedMode);
    } catch {}
  }, []);

  const preset = PRESETS.find((p) => p.key === presetKey) || PRESETS[0];
  const mode = OUTPUT_MODES.find((m) => m.key === modeKey) || OUTPUT_MODES[1];
  const coverPrompt = useMemo(() => buildCoverPrompt(payload || {}, preset), [payload, preset]);
  const detailPrompt = useMemo(() => mode.detail ? buildDetailPrompt(payload || {}, mode.detail) : "", [payload, mode]);

  function changePreset(value) {
    setPresetKey(value);
    try { localStorage.setItem("bs_data_lab_prompt_preset", value); } catch {}
  }

  function changeMode(value) {
    setModeKey(value);
    try { localStorage.setItem("bs_data_lab_output_mode", value); } catch {}
  }

  async function copyPrompt(key, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(""), 1600);
    } catch { setCopiedKey(""); }
  }

  return (
    <section className={styles.promptBuilder}>
      <div className={styles.promptHeader}>
        <div>
          <span className={styles.promptEyebrow}>DATA LAB SERIES BUILDER</span>
          <h3>DATA LAB画像生成プロンプト</h3>
        </div>
        <div className={styles.promptSelectors}>
          <select value={modeKey} onChange={(e) => changeMode(e.target.value)}>
            {OUTPUT_MODES.map((m) => <option value={m.key} key={m.key}>{m.label}</option>)}
          </select>
          <select value={presetKey} onChange={(e) => changePreset(e.target.value)}>
            {PRESETS.map((p) => <option value={p.key} key={p.key}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <p className={styles.promptDescription}>出力形式：{mode.label}。1枚目は共通表紙、2枚構成では2枚目だけ共通／一果／初音／キイナに分岐します。</p>

      <div className={styles.promptPageLabel}>1枚目｜共通表紙</div>
      <textarea className={styles.promptTextarea} readOnly value={coverPrompt} />
      <button className={styles.promptCopyButton} type="button" onClick={() => copyPrompt("cover", coverPrompt)}>
        {copiedKey === "cover" ? "コピーしました ✓" : "1枚目のプロンプトをコピー"}
      </button>

      {detailPrompt && (
        <>
          <div className={styles.promptPageLabel}>2枚目｜{mode.label.replace(" 2枚", "")}詳細</div>
          <textarea className={styles.promptTextarea} readOnly value={detailPrompt} />
          <button className={styles.promptCopyButton} type="button" onClick={() => copyPrompt("detail", detailPrompt)}>
            {copiedKey === "detail" ? "コピーしました ✓" : "2枚目のプロンプトをコピー"}
          </button>
        </>
      )}

      <p className={styles.note}>日付を切り替えると、その日のDATA LAB集計値が1枚目・2枚目の両方へ自動反映されます。初音版は女子戦専用データがまだないため、架空の女子戦数値を生成しない安全設計です。</p>
    </section>
  );
}
