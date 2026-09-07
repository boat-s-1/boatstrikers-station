"use client";

import { useMemo, useState } from "react";
import styles from "./SocialMaterialsPanel.module.css";

const MAX_PICKS = 3;

const CHARACTER_META = {
  ichika: {
    heading: "一果の朝刊！今日のイン逃げ注目",
    description: "SNS使用に保存した一果AI候補の上位3レースから自動作成します。",
    postLead: "一果の朝刊🚤 今日のイン逃げ注目BEST3",
    detail: "AI期待度から今日の注目レースを厳選。",
    verticalTitle: "一果の朝刊",
    verticalTheme: "今日のイン逃げレース ベスト3",
    fallbackComment: "イン逃げ期待の本命候補！",
    empty: "一果の候補で「SNS使用」にチェックして「選択を保存」すると、ここに画像作成プロンプトとX投稿文が表示されます。",
  },
  hatsune: {
    heading: "初音の朝刊！今日のオススメ女子戦",
    description: "SNS使用に保存した初音AI候補の上位3レースから自動作成します。",
    postLead: "初音の朝刊🌸 今日のオススメ女子戦BEST3",
    detail: "女子戦AIから今日チェックしたい3レースを厳選。",
    verticalTitle: "初音の朝刊",
    verticalTheme: "今日のオススメ女子戦",
    fallbackComment: "女子戦で要チェック！",
    empty: "初音の候補で「SNS使用」にチェックして「選択を保存」すると、ここに画像作成プロンプトとX投稿文が表示されます。",
  },
  kiina: {
    heading: "キイナの朝刊！今日の穴狙い",
    description: "SNS使用に保存したキイナAI候補の上位3レースから自動作成します。",
    postLead: "キイナの朝刊🔥 今日の穴狙いBEST3",
    detail: "5アタマAIから今日の穴狙い候補を厳選。",
    verticalTitle: "キイナの朝刊",
    verticalTheme: "今日の穴狙い",
    fallbackComment: "5号艇の一撃に期待！",
    empty: "キイナの候補で「SNS使用」にチェックして「選択を保存」すると、ここに画像作成プロンプトとX投稿文が表示されます。",
  },
};

function formatClosingTime(value) {
  const text = String(value ?? "").trim();
  if (!text) return "時刻未取得";

  const hhmm = text.match(/^(\d{1,2}):(\d{2})/);
  if (hhmm) return `${String(hhmm[1]).padStart(2, "0")}:${hhmm[2]}`;

  const compact = text.match(/^(\d{3,4})$/);
  if (compact) {
    const padded = compact[1].padStart(4, "0");
    return `${padded.slice(0, 2)}:${padded.slice(2, 4)}`;
  }

  return text;
}

function probabilityText(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : null;
}

function normalizeComment(text, fallback, rankingType) {
  const typeFallback = rankingType === "hatsune_risky_best3"
    ? "イン崩れに注意したい一戦！"
    : rankingType === "hatsune_dominant_best3"
      ? "イン優勢で注目の女子戦！"
      : fallback;

  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[\r\n]/g, " ")
    .trim();

  if (!cleaned) return typeFallback;

  const firstSentence = cleaned.split(/[。！？!？]/)[0].trim();
  const base = firstSentence || cleaned;
  const chars = Array.from(base);
  return chars.length > 24 ? `${chars.slice(0, 24).join("")}…` : base;
}

function buildImagePrompt(picks) {
  const raceLines = picks
    .map((pick, index) => {
      const closing = formatClosingTime(pick.closingTime);
      return `${index + 1}位の枠：\n${pick.courseName}${pick.raceNo}R\n${closing}〆切`;
    })
    .join("\n\n");

  return `添付テンプレート画像の「1位・2位・3位」の白枠内だけを編集してください。その他のデザイン、キャラクター、背景、タイトル、ボート、色、レイアウトは一切変更しないでください。\n\n${raceLines}\n\n【文字配置】\n・各順位の既存の「1位」「2位」「3位」はそのまま残す\n・順位番号の下に「場名＋R」を大きく太字で中央揃え\n・その下に「HH:MM〆切」を少し小さく中央揃え\n・文字は白枠内に収め、はみ出さない\n・日本語文字を崩さず、読みやすさを最優先する\n・上記以外の要素は変更しない`;
}

function buildVerticalImagePrompt(picks, meta) {
  const raceLines = picks
    .map((pick, index) => {
      const closing = formatClosingTime(pick.closingTime);
      const comment = normalizeComment(pick.summary, meta.fallbackComment, pick.rankingType);
      return `${index + 1}位の枠：\n${pick.courseName}${pick.raceNo}R\n${closing}〆切\n一言コメント：${comment}`;
    })
    .join("\n\n");

  return `添付した縦長の「${meta.verticalTitle}」テンプレート画像をそのまま使用し、「1位・2位・3位」の白い順位枠の中だけを編集してください。\n\n【最重要】\n・画像全体の縦横比、キャラクター、ボート、背景、水しぶき、タイトル「${meta.verticalTitle}」、中央の見出し「${meta.verticalTheme}」、吹き出し、色、装飾、順位デザインは一切変更しない\n・白い3つの順位枠以外には文字や要素を追加しない\n・既存の「1位」「2位」「3位」は消さず、そのまま残す\n\n${raceLines}\n\n【各順位枠の文字配置】\n・順位表示の右側の空きスペースを使う\n・1段目：「場名＋R」を最も大きく、太字で見やすく配置\n・2段目：「HH:MM〆切」を1段目より少し小さく配置\n・3段目：「一言コメント」をさらに少し小さく配置し、1〜2行以内に収める\n・コメントは短く読みやすくし、枠から絶対にはみ出さない\n・3つの枠で文字サイズ、行間、位置を統一する\n・日本語文字を崩さず、読みやすさを最優先する\n・元画像の雰囲気を維持し、画像全体を描き直さない`;
}

function countChars(text) {
  return Array.from(text).length;
}

function buildXPost(picks, meta) {
  const medals = ["🥇", "🥈", "🥉"];
  const raceLinesWithPct = picks.map((pick, index) => {
    const pct = probabilityText(pick.probability);
    const closing = formatClosingTime(pick.closingTime);
    return `${medals[index]}${pick.courseName}${pick.raceNo}R ${closing}${pct ? `｜AI ${pct}` : ""}`;
  });

  const raceLines = picks.map(
    (pick, index) => `${medals[index]}${pick.courseName}${pick.raceNo}R ${formatClosingTime(pick.closingTime)}`
  );

  const compactLines = picks.map(
    (pick, index) => `${index + 1}位 ${pick.courseName}${pick.raceNo}R ${formatClosingTime(pick.closingTime)}`
  );

  const variants = [
    `${meta.postLead}\n${raceLinesWithPct.join("\n")}\n${meta.detail}詳しくはBoatStrikersで！ #ボートレース`,
    `${meta.postLead}\n${raceLines.join("\n")}\n${meta.detail}詳しくはBoatStrikersで！ #ボートレース`,
    `${meta.postLead}\n${compactLines.join("\n")}\n詳しくはBoatStrikersで！ #ボートレース`,
  ];

  return variants.find((text) => countChars(text) <= 140) || Array.from(variants[2]).slice(0, 140).join("");
}

async function copyText(text, setter) {
  try {
    await navigator.clipboard.writeText(text);
    setter(true);
    window.setTimeout(() => setter(false), 1600);
  } catch {
    setter(false);
  }
}

export default function SocialMaterialsPanel({ picks = [], date, timing, character = "ichika" }) {
  const meta = CHARACTER_META[character] || CHARACTER_META.ichika;
  const selected = useMemo(
    () => picks.slice().sort((a, b) => Number(a.rankNo) - Number(b.rankNo)).slice(0, MAX_PICKS),
    [picks]
  );
  const [promptCopied, setPromptCopied] = useState(false);
  const [verticalPromptCopied, setVerticalPromptCopied] = useState(false);
  const [postCopied, setPostCopied] = useState(false);

  const imagePrompt = useMemo(() => buildImagePrompt(selected), [selected]);
  const verticalImagePrompt = useMemo(() => buildVerticalImagePrompt(selected, meta), [selected, meta]);
  const xPost = useMemo(() => buildXPost(selected, meta), [selected, meta]);
  const xLength = countChars(xPost);

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div>
          <span>SNS MATERIALS</span>
          <h2>{meta.heading}</h2>
          <p>{meta.description}</p>
        </div>
        <div className={styles.meta}>
          <strong>{selected.length}/3レース</strong>
          <small>{date} ／ {timing === "after_exhibition" ? "展示後版" : "前日版"}</small>
        </div>
      </div>

      {selected.length === 0 ? (
        <div className={styles.empty}>{meta.empty}</div>
      ) : (
        <>
          <div className={styles.pickPreview}>
            {selected.map((pick, index) => (
              <div className={styles.pick} key={`${pick.rankNo}-${pick.courseCode}-${pick.raceNo}`}>
                <b>{index + 1}位</b>
                <strong>{pick.courseName}{pick.raceNo}R</strong>
                <span>{formatClosingTime(pick.closingTime)}〆切</span>
                <small>{normalizeComment(pick.summary, meta.fallbackComment, pick.rankingType)}</small>
                {probabilityText(pick.probability) ? <small>AI {probabilityText(pick.probability)}</small> : null}
              </div>
            ))}
          </div>

          {selected.length < 3 ? (
            <div className={styles.warning}>画像テンプレートはBEST3用です。SNS使用を3レース選ぶと完成形になります。</div>
          ) : null}

          <div className={styles.materialGrid}>
            <article className={styles.materialCard}>
              <div className={styles.cardHeader}>
                <div>
                  <span>IMAGE PROMPT</span>
                  <h3>画像作成プロンプト</h3>
                </div>
                <button type="button" onClick={() => copyText(imagePrompt, setPromptCopied)}>
                  {promptCopied ? "コピーしました" : "コピー"}
                </button>
              </div>
              <textarea readOnly value={imagePrompt} rows={15} />
            </article>

            <article className={styles.materialCard}>
              <div className={styles.cardHeader}>
                <div>
                  <span>VERTICAL IMAGE PROMPT</span>
                  <h3>縦長・朝刊画像プロンプト</h3>
                </div>
                <button type="button" onClick={() => copyText(verticalImagePrompt, setVerticalPromptCopied)}>
                  {verticalPromptCopied ? "コピーしました" : "コピー"}
                </button>
              </div>
              <textarea readOnly value={verticalImagePrompt} rows={22} />
            </article>

            <article className={styles.materialCard}>
              <div className={styles.cardHeader}>
                <div>
                  <span>X POST</span>
                  <h3>X投稿文</h3>
                </div>
                <button type="button" onClick={() => copyText(xPost, setPostCopied)}>
                  {postCopied ? "コピーしました" : "コピー"}
                </button>
              </div>
              <textarea readOnly value={xPost} rows={9} />
              <div className={`${styles.counter} ${xLength > 140 ? styles.over : ""}`}>
                {xLength} / 140文字
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  );
}
