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

function characterDetail(payload, code) {
  const details = payload?.character_details || {};
  return details?.[code] && typeof details[code] === "object" ? details[code] : {};
}

function valueOrBlank(value) {
  return value === null || value === undefined || value === "" ? "（集計データがある場合のみ表示）" : String(value);
}

function buildCoverPrompt(payload, preset) {
  const s = statsMap(payload);
  const title = payload?.title || "昨日のボートレースを数字で見る";
  const headline = payload?.headline || "";
  const date = payload?.date || "";

  return `BoatStrikers DATA LABの9:16縦長SNS画像【1枚目・共通表紙】を作成してください。\n\n【最重要】\n・1080×1920、9:16\n・毎日同じ構成で使う固定テンプレート\n・上部に一果・初音・キイナ、中央〜下部にデータカード\n・数値、場名、出目、配当は下記データから絶対に変更しない\n・文字化け、余計な英語、架空の数値を追加しない\n・「事故・異常者」「異常者」「事故・異常着」という表現は使用せず、必ず「事故レース」と表記する\n・事故レースの数値は該当選手数や事故件数ではなく、対象事象が1件以上発生したユニークなレース数。複数艇が同一レースで該当しても1Rとして扱う\n・濃紺、ダークブルー、白、ゴールドを基本色にする\n・SNSの表紙として、タイトル、最高配当、万舟本数が一目で伝わること\n\n【選択デザイン】\n${preset.label}\n${preset.tone}\n\n【3キャラクター】\n左：一果。深緑系、落ち着いたリーダー感、イン逃げ分析担当。\n中央：初音。紫髪、ピンクのうさ耳フード、女子戦分析担当。\n右：キイナ。黄色〜ゴールド系、元気で攻めた雰囲気、穴・高配当分析担当。\nタグは「一果｜イン逃げ分析」「初音｜女子戦分析」「キイナ｜穴・高配当分析」。\n\n【表紙レイアウト】\n・BoatStrikers DATA LABロゴ\n・日付：${date}\n・タイトル：${title}\n・強調サマリー：${headline}\n・開催：${s["開催"] || s["開催数"] || ""}\n・万舟：${s["万舟"] || ""}\n・万舟率：${s["万舟率"] || ""}\n・1号艇1着：${s["1号艇1着"] || s["1号艇1着数"] || ""}\n・5号艇1着：${s["5号艇1着"] || s["5号艇1着数"] || ""}\n・逃げ：${s["逃げ"] || ""}\n・最高配当：${topText(payload)}\n・万舟が多かった場TOP5：\n${rankingLines(payload)}\n・事故レース：${payload?.incident_races || 0}R\n・優勝戦・DR：${payload?.featured_races || 0}R\n\n【表紙ルール】\n・3人は上部25〜30%以内\n・最高配当カードだけ白〜淡いゴールド背景で強く目立たせる\n・数字は大きく、項目名は小さく\n・最下部に「昨日の結果を、数字で振り返る。」「BoatStrikers」「boat-strike.online」\n・2枚構成で使う場合も1枚目単体で意味が通じる完成度にする。`;
}

function buildDetailPrompt(payload, mode) {
  const s = statsMap(payload);
  const date = payload?.date || "";
  const escapeText = s["逃げ"] || "";
  const escapeRateMatch = escapeText.match(/\(([^)]+)\)/);
  const escapeRate = escapeRateMatch ? escapeRateMatch[1] : "";
  const ichika = characterDetail(payload, "ichika");
  const hatsune = characterDetail(payload, "hatsune");
  const kiina = characterDetail(payload, "kiina");

  const base = `BoatStrikers DATA LABの9:16縦長SNS画像【2枚目・キャラ別詳細】を作成してください。\n1080×1920、9:16。1枚目と同じ濃紺・ダークブルー・白・ゴールドの世界観を維持し、キャラごとの専門分野に特化してください。\n下記に存在しない数値・ランキング・レース情報は絶対に推測・生成しないでください。データが無い項目は空欄のままにしてください。\n「事故・異常者」「異常者」「事故・異常着」は使用せず、事故に関するレース数は「事故レース」と表記してください。\n\n日付：${date}\n\n`;

  if (mode === "ichika") {
    return `${base}【一果｜イン逃げ特化】\nテーマは「イン逃げで昨日を読む」。一果を上部に配置し、緑アクセントで統一。\n万舟や最高配当は主役にせず、1号艇と逃げの結果だけを中心に見せる。\n\n【表示する項目】\n1号艇1着：${s["1号艇1着"] || s["1号艇1着数"] || ""}\n逃げ：${escapeText}\n逃げ率：${escapeRate}\nイン逃げ成功数：${valueOrBlank(ichika.escape_success_count)}\nイン崩れ数：${valueOrBlank(ichika.escape_failure_count)}\nイン逃げが強かった場 TOP3：${valueOrBlank(ichika.strong_venues)}\nイン崩れ注目レース TOP3：${valueOrBlank(ichika.upset_races)}\n一果メモ：${valueOrBlank(ichika.comment)}\n\n【固定レイアウト】\n・上段「一果 DATA LAB｜イン逃げ分析」\n・大きなカード：1号艇1着 / 逃げ / 逃げ率 / イン崩れ数\n・左ランキング「イン逃げが強かった場 TOP3」\n・右ランキング「イン崩れ注目レース TOP3」\n・下部に「一果メモ」\n\n見た瞬間に“インが勝ったのか、崩れたのか”が分かる構成にする。存在しない場別ランキングや注目レースは作らない。`;
  }

  if (mode === "hatsune") {
    return `${base}【初音｜女子戦特化】\nテーマは「昨日の女子戦だけを見る」。初音を上部に配置し、紫・ピンクアクセントで統一。\n全体集計を女子戦の数字として流用しない。女子戦専用データだけを使う。\n\n【表示する項目】\n女子戦数：${valueOrBlank(hatsune.race_count)}\n女子戦1号艇1着：${valueOrBlank(hatsune.boat1_wins)}\n女子戦逃げ数：${valueOrBlank(hatsune.escape_wins)}\n女子戦逃げ率：${valueOrBlank(hatsune.escape_rate)}\n女子戦万舟数：${valueOrBlank(hatsune.manshu_count)}\n女子戦最高配当：${valueOrBlank(hatsune.max_payout)}\n荒れた女子戦 TOP3：${valueOrBlank(hatsune.upset_races)}\n注目女子戦 TOP3：${valueOrBlank(hatsune.featured_races)}\n初音メモ：${valueOrBlank(hatsune.comment)}\n\n【固定レイアウト】\n・上段「初音 DATA LAB｜女子戦分析」\n・大きなカード：女子戦数 / 女子戦1号艇1着 / 女子戦逃げ率 / 女子戦万舟数 / 女子戦最高配当\n・左ランキング「荒れた女子戦 TOP3」\n・右ランキング「注目女子戦 TOP3」\n・下部に「初音メモ」\n\n女子戦データが無い項目は空欄。全体の万舟率や全体の1号艇1着を女子戦値として代用しない。`;
  }

  if (mode === "kiina") {
    return `${base}【キイナ｜穴・高配当特化】\nテーマは「昨日の穴と高配当だけを見る」。キイナを上部に配置し、黄色・ゴールドアクセントで統一。\n逃げや堅い決着は主役にせず、万舟・高配当・外枠頭を中心に見せる。\n\n【表示する項目】\n万舟本数：${s["万舟"] || ""}\n万舟率：${s["万舟率"] || ""}\n最高配当：${topText(payload)}\n5号艇1着：${s["5号艇1着"] || s["5号艇1着数"] || ""}\n4〜6号艇頭の高配当件数：${valueOrBlank(kiina.outer_head_high_payout_count)}\n荒れた場 TOP3：${valueOrBlank(kiina.upset_venues)}\n高配当レース TOP5：${valueOrBlank(kiina.high_payout_races)}\nキイナメモ：${valueOrBlank(kiina.comment)}\n\n【固定レイアウト】\n・上段「キイナ DATA LAB｜穴・高配当分析」\n・大きなカード：万舟 / 万舟率 / 最高配当 / 5号艇1着 / 4〜6号艇頭高配当件数\n・左ランキング「荒れた場 TOP3」\n・右ランキング「高配当レース TOP5」\n・下部に「キイナメモ」\n\n万舟が多かった場TOP5は補助データとして使用可能：\n${rankingLines(payload)}\n\n煽り文句で数値を盛らず、実際の穴・高配当データだけで構成する。`;
  }

  return `${base}【共通詳細】\n上段に主要数値、中段に万舟が多かった場TOP5と最高配当、下段に事故レース、優勝戦・DRを整理する。\n開催：${s["開催"] || s["開催数"] || ""}\n万舟：${s["万舟"] || ""}\n万舟率：${s["万舟率"] || ""}\n1号艇1着：${s["1号艇1着"] || s["1号艇1着数"] || ""}\n5号艇1着：${s["5号艇1着"] || s["5号艇1着数"] || ""}\n逃げ：${escapeText}\n最高配当：${topText(payload)}\n万舟TOP5：\n${rankingLines(payload)}\n事故レース：${payload?.incident_races || 0}R\n優勝戦・DR：${payload?.featured_races || 0}R`;
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

      <p className={styles.promptDescription}>出力形式：{mode.label}。2枚目は一果＝イン逃げ、初音＝女子戦、キイナ＝穴・高配当に完全特化します。</p>

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

      <p className={styles.note}>各キャラの専門外データは使わず、未集計項目は空欄にします。一果はイン逃げ、初音は女子戦専用データ、キイナは穴・高配当だけを扱います。</p>
    </section>
  );
}
