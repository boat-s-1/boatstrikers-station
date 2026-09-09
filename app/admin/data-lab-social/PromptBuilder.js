"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const PRESETS = [
  { key: "simple", label: "シンプル版", tone: "データの読みやすさを最優先。キャラクターは入れず、濃紺・白・黄色の洗練されたスポーツデータ風。" },
  { key: "three", label: "3人入り版", tone: "一果・初音・キイナの3人を小さなワンポイントとして配置。データ7：ブランド3。数字や文字には重ねない。" },
  { key: "ichika", label: "一果版", tone: "一果を小さく配置し、赤アクセントを追加。イン逃げ・1号艇の数字を自然に目立たせる。" },
  { key: "hatsune", label: "初音版", tone: "初音を小さく配置し、青アクセントを追加。知的で爽やかなデータラボ感を強める。" },
  { key: "kiina", label: "キイナ版", tone: "キイナを小さく配置し、黄色アクセントを強める。万舟・高配当・穴決着を印象的に見せる。" },
  { key: "luxury", label: "高級感版", tone: "キャラクターは控えめ。濃紺・白・ゴールド寄りの黄色で、プレミアムなスポーツデータ誌のように仕上げる。" },
  { key: "anime", label: "アニメ強め版", tone: "一果・初音・キイナの3人を少し大きめに入れ、アニメ・VTuber番組のような親しみやすさを追加。ただし数字の視認性を優先。" },
];

function lineStats(payload) {
  const stats = Array.isArray(payload?.stats) ? payload.stats : [];
  return stats.map((s) => `- ${s.label}：${s.value}`).join("\n");
}

function rankingLines(payload) {
  const ranking = Array.isArray(payload?.venue_manshu_ranking) ? payload.venue_manshu_ranking : [];
  if (!ranking.length) return "- 該当なし";
  return ranking.slice(0, 5).map((r, i) => `- ${i + 1}. ${r.venue} ${r.count}本`).join("\n");
}

function topText(payload) {
  const top = payload?.max_payout;
  if (!top) return "万舟なし";
  return `${top.venue}${top.race_no}R / ${top.trifecta} / ${Number(top.payout || 0).toLocaleString("ja-JP")}円`;
}

function buildPrompt(payload, preset) {
  const title = payload?.title || "昨日のボートレースを数字で見る";
  const headline = payload?.headline || "";
  return `参考画像のレイアウトをベースに、BoatStrikers DATA LABの9:16 SNS用インフォグラフィックを作成してください。\n\n【最重要】\n・画像サイズ：1080×1920、9:16\n・データが主役。情報の正確さと視認性を最優先\n・濃紺ベース、白文字、黄色を重要数字の強調色に使用\n・角丸カードと十分な余白を使い、SNSで一目で数字が入る構成\n・元データの数値、場名、出目、配当は絶対に変更しない\n・文字を不自然な位置で改行しない\n・下部が切れないよう安全マージンを確保\n\n【選択デザイン】\n${preset.label}\n${preset.tone}\n\n【ヘッダー】\n左：BOATSTRIKERS DATA LAB\n右：${payload?.date || ""}\n\n【メインタイトル】\n${title}\n最大2行。読みやすく大きく表示。\n\n【強調見出し】\n${headline}\n黄色で強調し、その日の最重要情報として扱う。\n\n【数値カード】\n${lineStats(payload)}\n\n【最高配当カード】\n白背景で最も目立つカード。\n${topText(payload)}\n配当金額を最も大きく表示。\n\n【万舟が多かった場 TOP5】\n${rankingLines(payload)}\n\n【事故・特別レース】\n- 事故・異常着：${payload?.incident_races || 0}R\n- 優勝戦・DR：${payload?.featured_races || 0}R\n\n【フッター】\n昨日の結果を、数字で振り返る。\nboat-strike.online\n詳しくはBoatStrikersで\n\n【ブランド表現】\nBoatStrikersらしいボートレースのスピード感、水しぶき、データ分析感を薄く加えてください。装飾は控えめにし、数字の視認性を邪魔しないこと。キャラクターを使うプリセットでは、一果・初音・キイナの見た目を既存の公式キャラクターデザインから変更しないこと。`;
}

export default function PromptBuilder({ payload }) {
  const [presetKey, setPresetKey] = useState("three");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bs_data_lab_prompt_preset");
      if (saved && PRESETS.some((p) => p.key === saved)) setPresetKey(saved);
    } catch {}
  }, []);

  const preset = PRESETS.find((p) => p.key === presetKey) || PRESETS[1];
  const prompt = useMemo(() => buildPrompt(payload || {}, preset), [payload, preset]);

  function changePreset(value) {
    setPresetKey(value);
    try { localStorage.setItem("bs_data_lab_prompt_preset", value); } catch {}
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={styles.promptBuilder}>
      <div className={styles.promptHeader}>
        <div>
          <span className={styles.promptEyebrow}>AI IMAGE PROMPT</span>
          <h3>画像生成プロンプト</h3>
        </div>
        <select value={presetKey} onChange={(e) => changePreset(e.target.value)}>
          {PRESETS.map((p) => <option value={p.key} key={p.key}>{p.label}</option>)}
        </select>
      </div>
      <p className={styles.promptDescription}>{preset.tone}</p>
      <textarea className={styles.promptTextarea} readOnly value={prompt} />
      <button className={styles.promptCopyButton} type="button" onClick={copyPrompt}>
        {copied ? "コピーしました ✓" : "このプロンプトをコピー"}
      </button>
      <p className={styles.note}>選択したプリセットはこの端末に保存されます。日付を変えると、その日の数値が自動でプロンプトに差し替わります。</p>
    </section>
  );
}
