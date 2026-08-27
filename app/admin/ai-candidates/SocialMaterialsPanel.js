"use client";

import { useMemo, useState } from "react";
import styles from "./SocialMaterialsPanel.module.css";

const MAX_PICKS = 3;

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

function buildImagePrompt(picks) {
  const raceLines = picks
    .map((pick, index) => {
      const closing = formatClosingTime(pick.closingTime);
      return `${index + 1}位の枠：\n${pick.courseName}${pick.raceNo}R\n${closing}〆切`;
    })
    .join("\n\n");

  return `添付テンプレート画像の「1位・2位・3位」の白枠内だけを編集してください。その他のデザイン、キャラクター、背景、タイトル、ボート、色、レイアウトは一切変更しないでください。\n\n${raceLines}\n\n【文字配置】\n・各順位の既存の「1位」「2位」「3位」はそのまま残す\n・順位番号の下に「場名＋R」を大きく太字で中央揃え\n・その下に「HH:MM〆切」を少し小さく中央揃え\n・文字は白枠内に収め、はみ出さない\n・日本語文字を崩さず、読みやすさを最優先する\n・上記以外の要素は変更しない`;
}

function countChars(text) {
  return Array.from(text).length;
}

function buildXPost(picks) {
  const medals = ["🥇", "🥈", "🥉"];
  const raceLinesWithPct = picks.map((pick, index) => {
    const pct = probabilityText(pick.probability);
    const closing = formatClosingTime(pick.closingTime);
    return `${medals[index]}${pick.courseName}${pick.raceNo}R ${closing}${pct ? `｜AI ${pct}` : ""}`;
  });

  const variants = [
    `一果の朝刊🚤 今日のイン逃げ注目BEST3\n${raceLinesWithPct.join("\n")}\nAI期待度から今日の注目レースを厳選。詳しくはBoatStrikersで！ #ボートレース`,
    `一果の朝刊🚤 今日のイン逃げ注目BEST3\n${picks.map((pick, index) => `${medals[index]}${pick.courseName}${pick.raceNo}R ${formatClosingTime(pick.closingTime)}`).join("\n")}\nAI期待度から厳選しました。詳しくはBoatStrikersで！ #ボートレース`,
    `一果の朝刊🚤 イン逃げ注目BEST3\n${picks.map((pick, index) => `${index + 1}位 ${pick.courseName}${pick.raceNo}R ${formatClosingTime(pick.closingTime)}`).join("\n")}\n詳しくはBoatStrikersで！ #ボートレース`,
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

export default function SocialMaterialsPanel({ picks = [], date, timing }) {
  const selected = useMemo(
    () => picks.slice().sort((a, b) => Number(a.rankNo) - Number(b.rankNo)).slice(0, MAX_PICKS),
    [picks]
  );
  const [promptCopied, setPromptCopied] = useState(false);
  const [postCopied, setPostCopied] = useState(false);

  const imagePrompt = useMemo(() => buildImagePrompt(selected), [selected]);
  const xPost = useMemo(() => buildXPost(selected), [selected]);
  const xLength = countChars(xPost);

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div>
          <span>SNS MATERIALS</span>
          <h2>一果の朝刊・SNS素材</h2>
          <p>SNS使用に保存した一果AI候補の上位3レースから自動作成します。</p>
        </div>
        <div className={styles.meta}>
          <strong>{selected.length}/3レース</strong>
          <small>{date} ／ {timing === "after_exhibition" ? "展示後版" : "前日版"}</small>
        </div>
      </div>

      {selected.length === 0 ? (
        <div className={styles.empty}>
          一果の候補で「SNS使用」にチェックして「選択を保存」すると、ここに画像作成プロンプトとX投稿文が表示されます。
        </div>
      ) : (
        <>
          <div className={styles.pickPreview}>
            {selected.map((pick, index) => (
              <div className={styles.pick} key={`${pick.rankNo}-${pick.courseCode}-${pick.raceNo}`}>
                <b>{index + 1}位</b>
                <strong>{pick.courseName}{pick.raceNo}R</strong>
                <span>{formatClosingTime(pick.closingTime)}〆切</span>
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
