"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const PRESETS = [
  { key: "three", label: "3人入り固定テンプレ", tone: "一果・初音・キイナを上部に配置し、管理画面の数値を固定座標へ流し込むBoatStrikers標準版。" },
  { key: "simple", label: "データ優先版", tone: "キャラクターは入れず、濃紺・白・ゴールドのデータ番組風。数字の読みやすさを最優先。" },
  { key: "luxury", label: "高級感版", tone: "3人は小さめ。濃紺・白・ゴールド中心でプレミアムなスポーツデータ誌の雰囲気。" },
  { key: "anime", label: "キャラ強め版", tone: "3人を少し大きめにし、VTuber番組のような親しみやすさを強める。ただしデータ欄を隠さない。" },
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

function buildPrompt(payload, preset) {
  const s = statsMap(payload);
  const title = payload?.title || "昨日のボートレースを数字で見る";
  const headline = payload?.headline || "";
  const date = payload?.date || "";

  return `BoatStrikers DATA LABの9:16縦長SNS画像を作成してください。\n\n【最重要】\n・1080×1920、9:16\n・毎日同じ構成で使う固定テンプレート\n・参考レイアウトは「上部に3キャラ、中央〜下部にデータカード」\n・数値、場名、出目、配当は下記データから絶対に変更しない\n・文字化け、余計な英語、架空の数値を追加しない\n・数字を最優先で読みやすくする\n・キャラクターがデータ欄を隠さない\n・濃紺、ダークブルー、白、ゴールドを基本色にする\n\n【選択デザイン】\n${preset.label}\n${preset.tone}\n\n【BoatStrikersキャラクター】\n上部に3人を横並びで配置。既存デザインを崩さない。\n左：一果。深緑〜グリーン系。落ち着いたリーダー感。イン逃げ分析担当。\n中央：初音。紫髪、ピンクのうさ耳フード。不思議で可愛い雰囲気。女子戦分析担当。\n右：キイナ。黄色〜ゴールド系、明るく元気で少し攻めた雰囲気。穴狙い分析担当。\n一果の下に緑のタグ「一果｜イン逃げ分析」\n初音の下に紫のタグ「初音｜女子戦分析」\nキイナの下に黄色のタグ「キイナ｜穴狙い分析」\n3人の背景に薄いモニター、ボートレース映像、データグラフ、水しぶき、HUDを入れる。\n\n【固定レイアウト】\n1. 上部：BoatStrikers DATA LABロゴ＋3キャラクター\n2. 大見出し：${title}\n3. サマリー帯：${headline}\n4. 右上の日付：${date}\n5. 開催カード\n6. 2列のデータカード群\n7. 横長の逃げカード\n8. 白×ゴールドの最高配当カード\n9. 左下「万舟が多かった場 TOP5」\n10. 右下「事故・異常者」「優勝戦・DR」\n11. 最下部フッター「昨日の結果を、数字で振り返る。」「BoatStrikers」「boat-strike.online」\n\n【差し込む実データ】\n開催：${s["開催"] || s["開催数"] || ""}\n万舟：${s["万舟"] || ""}\n万舟率：${s["万舟率"] || ""}\n1号艇1着：${s["1号艇1着"] || s["1号艇1着数"] || ""}\n5号艇1着：${s["5号艇1着"] || s["5号艇1着数"] || ""}\n逃げ：${s["逃げ"] || ""}\n\n最高配当：${topText(payload)}\n\n万舟が多かった場 TOP5\n${rankingLines(payload)}\n\n事故・異常者：${payload?.incident_races || 0}R\n優勝戦・DR：${payload?.featured_races || 0}R\n\n【デザインルール】\n・キャラクターは上部25〜30%以内に収める\n・データ部分は中央〜下部70%を使用\n・角丸カード、十分な余白、細いネオンブルー＋ゴールド縁取り\n・最高配当だけ白〜淡いゴールド背景で強く目立たせる\n・数字は大きく、項目名は小さくする\n・万舟TOP5は5行固定で、場名と本数を左右に分ける\n・背景装飾は薄くして文字の視認性を邪魔しない\n・SNSで縮小表示してもタイトル、最高配当、主要数値が読めること\n\n完成画像は、BoatStrikersの3人が毎日データを分析して発表している公式DATA LABとして統一感のあるデザインにしてください。`;
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

  const preset = PRESETS.find((p) => p.key === presetKey) || PRESETS[0];
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
          <span className={styles.promptEyebrow}>FIXED TEMPLATE PROMPT</span>
          <h3>DATA LAB画像生成プロンプト</h3>
        </div>
        <select value={presetKey} onChange={(e) => changePreset(e.target.value)}>
          {PRESETS.map((p) => <option value={p.key} key={p.key}>{p.label}</option>)}
        </select>
      </div>
      <p className={styles.promptDescription}>{preset.tone}</p>
      <textarea className={styles.promptTextarea} readOnly value={prompt} />
      <button className={styles.promptCopyButton} type="button" onClick={copyPrompt}>
        {copied ? "コピーしました ✓" : "今日の数値入りプロンプトをコピー"}
      </button>
      <p className={styles.note}>日付を切り替えると、その日のDATA LAB集計値が固定テンプレート用プロンプトへ自動反映されます。</p>
    </section>
  );
}
