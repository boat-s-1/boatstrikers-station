"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

function statsMap(payload) {
  const map = {};
  const stats = Array.isArray(payload?.stats) ? payload.stats : [];
  stats.forEach((s) => { map[String(s.label || "")] = String(s.value || ""); });
  return map;
}

function topText(payload) {
  const top = payload?.max_payout;
  if (!top) return "該当なし";
  return `${top.venue || ""}${top.race_no || ""}R ${top.trifecta || ""} / ${Number(top.payout || 0).toLocaleString("ja-JP")}円`;
}

function rankingLines(payload) {
  const ranking = Array.isArray(payload?.venue_manshu_ranking) ? payload.venue_manshu_ranking : [];
  if (!ranking.length) return "該当なし";
  return ranking.slice(0, 3).map((r, i) => `${i + 1}. ${r.venue || ""} ${r.count || 0}本`).join("\n");
}

function buildPrompt(payload) {
  const s = statsMap(payload);
  const date = payload?.date || "";
  const incident = payload?.incident_races ?? 0;
  const featured = payload?.featured_races ?? 0;

  return `BoatStrikers DATA LABのX（旧Twitter）投稿専用・横長コンパクト画像を作成してください。

【サイズ・用途】
・横長 16:9、推奨 1200×675px
・Xのタイムラインで一瞬で内容が伝わる、情報量を絞ったコンパクトな1枚
・スマホ表示でも数字が読めるよう、文字を大きくする
・9:16画像の内容をそのまま縮小せず、横長専用に再構成する

【デザイン】
・BoatStrikers DATA LABの濃紺・ダークブルー・白・ゴールドを基本色
・一果＝緑、初音＝紫、キイナ＝黄色/ゴールドのアクセント
・3人のキャラクターは右側または上部に小さく配置し、データを隠さない
・水面、ボート、データ分析モニターの要素を控えめに入れる
・タイトルと主要数字を最優先し、細かい説明文は入れすぎない

【重要ルール】
・以下の確定データだけを使用し、数値・場名・出目・配当を推測しない
・空欄のカード、順位枠、ダミー文字を作らない
・値が「該当なし」の項目は見出し・カードごと画像から削除する
・削除して空いたスペースは、残った主要数字とキャラクターを拡大して自然に詰める
・「[object Object]」を絶対に表示しない
・「事故・異常者」「異常者」「事故・異常着」は使用せず「事故レース」と表記する
・事故レースは該当選手数ではなく、対象事象が1件以上あったユニークレース数をR単位で表示する

【確定データ】
日付：${date}
タイトル：昨日のボートレースを数字で見る
開催：${s["開催"] || s["開催数"] || "該当なし"}
万舟：${s["万舟"] || "該当なし"}
万舟率：${s["万舟率"] || "該当なし"}
1号艇1着：${s["1号艇1着"] || s["1号艇1着数"] || "該当なし"}
5号艇1着：${s["5号艇1着"] || s["5号艇1着数"] || "該当なし"}
逃げ：${s["逃げ"] || "該当なし"}
最高配当：${topText(payload)}
事故レース：${incident}R
優勝戦・DR：${featured}R
万舟が多かった場 TOP3：
${rankingLines(payload)}

【横長レイアウト】
・左上：BoatStrikers DATA LAB + 日付
・左〜中央：その日の最重要数字を3〜5個だけ大きなカードで表示
・最高配当がある場合は中央で最も強く目立たせる
・万舟TOP3がある場合だけ、小さなランキングとして表示
・右側：一果・初音・キイナの3人をコンパクトに配置
・下部：BoatStrikers / boat-strike.online
・全データを無理に載せない。横長画像で読みやすい主要情報だけを採用する
・空欄を作るくらいなら項目を削除し、残った要素を大きく配置する。`;
}

export default function XPostImagePromptBuilder({ payload }) {
  const [copied, setCopied] = useState(false);
  const prompt = useMemo(() => buildPrompt(payload || {}), [payload]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { setCopied(false); }
  }

  return (
    <section className={styles.promptBuilder}>
      <div className={styles.promptHeader}>
        <div>
          <span className={styles.promptEyebrow}>X POST IMAGE BUILDER</span>
          <h3>X投稿専用・横長画像プロンプト</h3>
        </div>
      </div>
      <p className={styles.promptDescription}>Xのタイムライン向け16:9横長版です。確定データだけを使い、空欄のカードやランキング枠は作りません。</p>
      <textarea className={styles.promptTextarea} readOnly value={prompt} />
      <button className={styles.promptCopyButton} type="button" onClick={copyPrompt}>
        {copied ? "コピーしました ✓" : "X横長画像プロンプトをコピー"}
      </button>
    </section>
  );
}
