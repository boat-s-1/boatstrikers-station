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

function extractPercent(text) {
  const value = String(text || "");
  const match = value.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (match) return `${match[1]}%`;

  const loose = value.match(/(?:shadow|score|probability|prob|期待度|不安度)\s*[:=]?\s*(0(?:\.\d+)?|1(?:\.0+)?)\b/i);
  if (!loose) return null;

  const n = Number(loose[1]);
  if (!Number.isFinite(n)) return null;
  return `${(n * 100).toFixed(1)}%`;
}

function looksInternalComment(text) {
  const value = String(text || "").trim();
  if (!value) return false;

  if (/\b(?:ai\s*v?\s*2|shadow|model(?:_version)?|raw(?:_ranking)?|score|probability|tiebreak)\b/i.test(value)) {
    return true;
  }

  if (/^[\s\d.％%:+\-_/()]+$/.test(value)) return true;
  if (/^\d{1,3}(?:\.\d+)?\s*[%％]$/.test(value)) return true;

  return false;
}

function friendlyInternalComment(character, rankingType, percent, fallback) {
  if (character === "ichika") {
    return percent ? `イン逃げ期待度 ${percent}` : "イン逃げ期待の注目戦！";
  }

  if (character === "hatsune") {
    if (rankingType === "hatsune_risky_best3") {
      return percent ? `イン不安度 ${percent}` : "イン崩れに注意！";
    }
    return percent ? `女子戦期待度 ${percent}` : "女子戦で注目！";
  }

  if (character === "kiina") {
    return percent ? `穴期待度 ${percent}` : "高配当狙いで注目！";
  }

  return fallback;
}

function normalizeComment(text, fallback, rankingType, character) {
  const typeFallback = rankingType === "hatsune_risky_best3"
    ? "イン崩れに注意したい一戦！"
    : rankingType === "hatsune_dominant_best3"
      ? "イン優勢で注目の女子戦！"
      : fallback;

  const cleaned = String(text || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return typeFallback;

  if (looksInternalComment(cleaned)) {
    return friendlyInternalComment(character, rankingType, extractPercent(cleaned), typeFallback);
  }

  const firstSentence = cleaned.split(/[。！？!？]/)[0].trim();
  const base = firstSentence || cleaned;
  const chars = Array.from(base);
  return chars.length > 24 ? `${chars.slice(0, 24).join("")}…` : base;
}

function pickComment(pick, meta, character) {
  return normalizeComment(
    String(pick.socialComment || "").trim() || pick.summary,
    meta.fallbackComment,
    pick.rankingType,
    character
  );
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

function buildVerticalImagePrompt(picks, meta, character) {
  const raceLines = picks
    .map((pick, index) => {
      const closing = formatClosingTime(pick.closingTime);
      const comment = pickComment(pick, meta, character);
      return `${index + 1}位の枠：\n${pick.courseName}${pick.raceNo}R\n${closing}〆切\n一言コメント：${comment}`;
    })
    .join("\n\n");

  return `添付した縦長の「${meta.verticalTitle}」テンプレート画像をそのまま使用し、「1位・2位・3位」の白い順位枠の中だけを編集してください。\n\n【最重要】\n・画像全体の縦横比、キャラクター、ボート、背景、水しぶき、タイトル「${meta.verticalTitle}」、中央の見出し「${meta.verticalTheme}」、吹き出し、色、装飾、順位デザインは一切変更しない\n・白い3つの順位枠以外には文字や要素を追加しない\n・既存の「1位」「2位」「3位」は消さず、そのまま残す\n・「AI v2」「shadow」「model」「raw」「score」などの内部用モデル名・内部指標名は画像内に表示しない\n・内部用の文字列しかない場合は、一般ユーザー向けの自然な日本語コメントに変換した文言だけを表示する\n\n${raceLines}\n\n【各順位枠の文字配置】\n・順位表示の右側の空きスペースを使う\n・1段目：「場名＋R」を最も大きく、太字で見やすく配置\n・2段目：「HH:MM〆切」を1段目より少し小さく配置\n・3段目：「一言コメント」をさらに少し小さく配置し、1〜2行以内に収める\n・コメントは短く読みやすくし、枠から絶対にはみ出さない\n・3つの枠で文字サイズ、行間、位置を統一する\n・日本語文字を崩さず、読みやすさを最優先する\n・元画像の雰囲気を維持し、画像全体を描き直さない`;
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

function normalizeTrifecta(value) {
  const digits = String(value || "").match(/[1-6]/g) || [];
  return digits.slice(0, 3).join("-");
}

function resultSummary(pick) {
  const result = normalizeTrifecta(pick.trifecta);
  const tickets = Array.isArray(pick.tickets)
    ? pick.tickets.map(normalizeTrifecta).filter(Boolean)
    : [];
  if (!result || tickets.length === 0) return null;

  const hit = tickets.includes(result);
  const unitStake = Number(pick.unitStake || 0);
  const payout = Number(pick.trifectaPayout || 0);
  const returnAmount = hit && unitStake > 0 && payout > 0
    ? Math.round(payout * (unitStake / 100))
    : 0;

  return {
    result,
    tickets,
    hit,
    unitStake,
    investment: Number(pick.investment || tickets.length * unitStake || 0),
    payout,
    returnAmount,
  };
}

function resultCharacterLabel(character) {
  if (character === "hatsune") return "初音";
  if (character === "kiina") return "キイナ";
  return "一果";
}

function buildResultXPost(pick, character) {
  const summary = resultSummary(pick);
  if (!summary) return "";

  const label = resultCharacterLabel(character);
  const ticketText = summary.tickets.join(" / ");
  const lines = summary.hit
    ? [
        `🎯 BoatStrikers AI RESULT｜${label}`,
        `【${pick.courseName}${pick.raceNo}R】的中！`,
        `買い目：${ticketText}`,
        `結果：${summary.result}　払戻：${summary.payout.toLocaleString("ja-JP")}円`,
        `回収：${summary.returnAmount.toLocaleString("ja-JP")}円 / 投資${summary.investment.toLocaleString("ja-JP")}円`,
        "#BoatStrikers #ボートレース",
      ]
    : [
        `📊 BoatStrikers AI RESULT｜${label}`,
        `【${pick.courseName}${pick.raceNo}R】不的中`,
        `買い目：${ticketText}`,
        `結果：${summary.result}`,
        "事前に選んだAI候補の結果をそのまま公開。",
        "#BoatStrikers #ボートレース",
      ];

  const full = lines.join("\n");
  if (countChars(full) <= 140) return full;

  const compact = summary.hit
    ? `🎯${label} AI RESULT｜${pick.courseName}${pick.raceNo}R 的中！\n結果 ${summary.result}｜払戻 ${summary.payout.toLocaleString("ja-JP")}円｜回収 ${summary.returnAmount.toLocaleString("ja-JP")}円\n#BoatStrikers #ボートレース`
    : `📊${label} AI RESULT｜${pick.courseName}${pick.raceNo}R 不的中\n結果 ${summary.result}\n事前選択したAI候補の結果です。\n#BoatStrikers #ボートレース`;

  return countChars(compact) <= 140 ? compact : Array.from(compact).slice(0, 140).join("");
}

function buildResultImagePrompt(pick, character) {
  const summary = resultSummary(pick);
  if (!summary) return "";

  const label = resultCharacterLabel(character);
  const accent = character === "hatsune"
    ? "紫・ピンク"
    : character === "kiina"
      ? "黄色・ゴールド"
      : "緑・ゴールド";
  const verdict = summary.hit ? "🎯 的中！" : "RESULT 不的中";
  const hitDetail = summary.hit
    ? `・払戻：${summary.payout.toLocaleString("ja-JP")}円\n・投資：${summary.investment.toLocaleString("ja-JP")}円\n・回収：${summary.returnAmount.toLocaleString("ja-JP")}円`
    : "・不的中を過度にネガティブに演出せず、結果報告として見せる";

  return `BoatStrikersのX投稿用「AI RESULT」画像を作成してください。

【画像】
・横長16:9、1200×675px
・Xのスマホタイムラインで一瞬で結果が分かる構成
・濃紺・ダークブルー・白・ゴールドを基調
・${label}のキャラクター世界観を維持し、${accent}をアクセントにする
・スポーツ速報／データ速報のように、結果を大きく読みやすく表示
・文字を詰め込みすぎない

【確定データ】
担当：${label}
レース：${pick.courseName}${pick.raceNo}R
事前保存済み買い目：${summary.tickets.join(" / ")}
結果：${summary.result}
判定：${verdict}
${hitDetail}

【最重要ルール】
・レース前に固定保存された買い目だけを表示する
・結果確定後に予想内容を書き換えない
・結果、出目、払戻は入力された確定データだけを使用する
・入力されていない数字、場名、買い目、配当を推測しない
・「AI v2」「shadow」「model」「raw」「score」など内部モデル名・内部指標は表示しない
・[object Object]を絶対に表示しない
・的中／不的中の判定を変更しない

【表示優先順位】
1. ${verdict}
2. ${pick.courseName}${pick.raceNo}R
3. 結果 ${summary.result}
4. 事前保存済み買い目
${summary.hit ? "5. 払戻・投資・回収" : ""}

【フッター】
BoatStrikers
AI RESULT
boat-strike.com`;
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
  const [resultCopied, setResultCopied] = useState("");

  const imagePrompt = useMemo(() => buildImagePrompt(selected), [selected]);
  const verticalImagePrompt = useMemo(() => buildVerticalImagePrompt(selected, meta, character), [selected, meta, character]);
  const xPost = useMemo(() => buildXPost(selected, meta), [selected, meta]);
  const resolvedResults = useMemo(
    () => selected.map((pick) => ({ pick, summary: resultSummary(pick) })).filter((item) => item.summary),
    [selected]
  );
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
                <small>{pickComment(pick, meta, character)}</small>
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

          <section className={styles.resultSection}>
            <div className={styles.resultHeading}>
              <div>
                <span>AI RESULT MATERIALS</span>
                <h3>結果確定後のX投稿素材</h3>
                <p>事前に固定された公開買い目と確定3連単結果だけで判定します。</p>
              </div>
              <strong>{resolvedResults.length}/{selected.length}レース確定</strong>
            </div>

            {resolvedResults.length === 0 ? (
              <div className={styles.resultWaiting}>結果が確定すると、的中／不的中のX投稿文と結果画像プロンプトがここに表示されます。</div>
            ) : (
              <div className={styles.resultGrid}>
                {resolvedResults.map(({ pick, summary }) => {
                  const key = `${pick.rankingType}-${pick.rankNo}-${pick.courseCode}-${pick.raceNo}`;
                  const resultPost = buildResultXPost(pick, character);
                  const resultPrompt = buildResultImagePrompt(pick, character);
                  return (
                    <article className={styles.resultCard} key={key}>
                      <div className={styles.resultTop}>
                        <div>
                          <span className={summary.hit ? styles.hitBadge : styles.missBadge}>
                            {summary.hit ? "🎯 的中" : "不的中"}
                          </span>
                          <strong>{pick.courseName}{pick.raceNo}R</strong>
                        </div>
                        <b>結果 {summary.result}</b>
                      </div>

                      <div className={styles.resultFacts}>
                        <span>買い目 {summary.tickets.join(" / ")}</span>
                        <span>投資 {summary.investment.toLocaleString("ja-JP")}円</span>
                        {summary.hit ? <span>払戻 {summary.payout.toLocaleString("ja-JP")}円</span> : null}
                        {summary.hit ? <span>回収 {summary.returnAmount.toLocaleString("ja-JP")}円</span> : null}
                      </div>

                      <div className={styles.resultMaterials}>
                        <div>
                          <div className={styles.resultMaterialHeader}>
                            <b>X投稿文</b>
                            <button
                              type="button"
                              onClick={() => copyText(resultPost, (done) => setResultCopied(done ? `${key}:post` : ""))}
                            >
                              {resultCopied === `${key}:post` ? "コピーしました" : "コピー"}
                            </button>
                          </div>
                          <textarea readOnly value={resultPost} rows={7} />
                          <small>{countChars(resultPost)} / 140文字</small>
                        </div>

                        <div>
                          <div className={styles.resultMaterialHeader}>
                            <b>結果画像プロンプト</b>
                            <button
                              type="button"
                              onClick={() => copyText(resultPrompt, (done) => setResultCopied(done ? `${key}:prompt` : ""))}
                            >
                              {resultCopied === `${key}:prompt` ? "コピーしました" : "コピー"}
                            </button>
                          </div>
                          <textarea readOnly value={resultPrompt} rows={13} />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
