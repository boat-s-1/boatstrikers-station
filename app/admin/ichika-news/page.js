"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./page.module.css";
import NewsCandidatePicker from "../news-candidate-picker/NewsCandidatePicker";

const STADIUMS = [
  "桐生","戸田","江戸川","平和島","多摩川","浜名湖","蒲郡","常滑","津","三国","びわこ","住之江",
  "尼崎","鳴門","丸亀","児島","宮島","徳山","下関","若松","芦屋","福岡","唐津","大村"
];

const EXPRESSIONS = [
  ["smile","にっこり笑顔"],
  ["wink","ウインク"],
  ["cheerful","元気な笑顔"],
  ["serious","真剣"],
  ["confident","自信あり"],
  ["supportive","応援・励ます"],
  ["surprised","驚き"],
  ["thinking","考え中"],
];

const POSES = [
  ["pointing","指さし"],
  ["cheering","応援ポーズ"],
  ["fists_up","両手を握ってガッツポーズ"],
  ["waving","手を振る"],
  ["explaining","解説ポーズ"],
  ["hand_on_hip","片手を腰に当てる"],
  ["hands_clasped","両手を胸の前で握る"],
  ["energetic","元気に片手を上げる"],
];

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function labelOf(options, value) {
  return options.find(([key]) => key === value)?.[1] || value;
}

function shortDate(value) {
  if (!value) return "";
  const [, m, d] = value.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function buildPrompt(v) {
  const edition = v.edition === "just_before" ? "直前版" : "前日版";
  const topExpression = labelOf(EXPRESSIONS, v.topExpression);
  const topPose = labelOf(POSES, v.topPose);
  const mainExpression = labelOf(EXPRESSIONS, v.mainExpression);
  const mainPose = labelOf(POSES, v.mainPose);

  const exhibition = v.edition === "just_before"
    ? `
【展示気配】
・1号艇：${v.exhibition1 || "未入力"}
・2号艇：${v.exhibition2 || "未入力"}
・3号艇：${v.exhibition3 || "未入力"}`
    : "";

  return `添付した「一果ちゃん新聞」の学級新聞風テンプレートをベースに、BoatStrikersの一果新聞を作成してください。

【基本情報】
・日付：${v.date}
・表示日付：${shortDate(v.date)}
・場名：${v.course}
・レース：${v.raceNo}R
・版：${edition}

【最重要】
・一果ちゃんの髪色、顔立ち、目、制服・衣装、デフォルメ感、BoatStrikersのキャラクター性は維持する
・緑を基調とした親しみやすい学級新聞テイストを維持する
・新聞として情報が一瞬で読めるよう、余白と文字の優先順位を整理する
・場名、レース番号、数値、コメントは下記の入力内容だけを使用し、推測で補完しない
・「AI v2」「shadow」「model」「raw」「score」など内部用モデル名・内部指標名は表示しない
・[object Object]を絶対に表示しない
・日本語の文字崩れを避け、読みやすさを最優先する

【上部ヘッダー】
${shortDate(v.date)} ${v.course}${v.raceNo}R　${edition}

【メインコピー】
${v.mainCopy || "インの力を信じて、堅く、着実に！"}

【イン逃げデータ】
・このレースのイン逃げ率：${v.escapeRate || "—"}%
・全国平均：${v.nationalAverage || "—"}%

【吹き出し】
${v.speech || "インの力に注目！"}

【本命】
・本命艇：${v.honmeiBoat || "1"}号艇
・本命見出し：${v.honmeiTitle || "イン逃げで信頼度◎"}
・本命コメント：${v.honmeiComment || "スタートを決めて押し切りに期待！"}

【一果のひとこと】
${v.ichikaComment || "インの気配を中心に、相手候補までしっかり見ていこう！"}
${exhibition}

【一果ちゃんの演出】
■ 右上キャラクター
・表情：${topExpression}
・ポーズ：${topPose}
・補足：${v.topNotes || "明るく親しみやすい雰囲気"}

■ 本文側キャラクター
・表情：${mainExpression}
・ポーズ：${mainPose}
・補足：${v.mainNotes || "新聞を解説している自然な雰囲気"}

【レイアウト】
・上段：日付 / 場名 / レース / ${edition} を明確に表示
・左〜中央：メインコピー、イン逃げ率、本命情報
・右上：右上キャラクター
・下段：一果のひとこと${v.edition === "just_before" ? "と展示気配" : ""}
・本文側キャラクターは情報を隠さない位置に配置
・数字「${v.escapeRate || "—"}%」は新聞内で最も目立つ数値の1つとして大きく表示
・元テンプレートの学級新聞らしい罫線・囲み・見出し感を維持する
・過度に装飾を増やさず、必要情報を絞って見やすくする`;
}

function buildXPost(v) {
  const edition = v.edition === "just_before" ? "直前版" : "前日版";
  const line2 = v.escapeRate ? `イン逃げ率 ${v.escapeRate}%${v.nationalAverage ? `（全国平均 ${v.nationalAverage}%）` : ""}` : "";
  const line3 = v.edition === "just_before" && v.exhibition1
    ? `展示：1号艇 ${v.exhibition1}`
    : v.honmeiComment;
  return [
    `📰 一果ちゃん新聞｜${shortDate(v.date)} ${v.course}${v.raceNo}R ${edition}`,
    line2,
    line3,
    "#BoatStrikers #ボートレース",
  ].filter(Boolean).join("\n");
}

const DEFAULTS = {
  date: todayJst(),
  course: "宮島",
  raceNo: "1",
  edition: "previous_day",
  mainCopy: "インの力を信じて、堅く、着実に！",
  escapeRate: "84",
  nationalAverage: "73",
  speech: "宮島はインが強い水面！まずは1号艇から狙おう！",
  honmeiBoat: "1",
  honmeiTitle: "イン逃げで信頼度◎",
  honmeiComment: "スタートを決めて押し切りに期待！",
  ichikaComment: "宮島はインが素直に決まりやすい水面です。まずは1号艇の逃げから。相手は2・3号艇を中心に！",
  exhibition1: "行き足が軽く、スタート気配も上々。",
  exhibition2: "差し足に注意したい気配。",
  exhibition3: "伸びが良く、外からの一撃候補。",
  topExpression: "wink",
  topPose: "pointing",
  aiTickets: [],
  aiUnitStake: 0,
  aiInvestment: 0,
  aiRankNo: null,
  topNotes: "読者に向かって明るくアピール",
  mainExpression: "smile",
  mainPose: "hands_clasped",
  mainNotes: "親しみやすく新聞内容を紹介",
};

export default function IchikaNewsAdmin() {
  const [v, setV] = useState(DEFAULTS);
  const [copied, setCopied] = useState("");
  const [importState, setImportState] = useState({ status: "idle", message: "", source: "manual" });

  const prompt = useMemo(() => buildPrompt(v), [v]);
  const xPost = useMemo(() => buildXPost(v), [v]);

  function set(key, value) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  function preset(type) {
    if (type === "cheer") {
      setV((prev) => ({
        ...prev,
        topExpression: "cheerful",
        topPose: "energetic",
        mainExpression: "supportive",
        mainPose: "fists_up",
        topNotes: "元気よく今日の注目レースを紹介",
        mainNotes: "読者を応援する明るい雰囲気",
      }));
    } else if (type === "analysis") {
      setV((prev) => ({
        ...prev,
        topExpression: "confident",
        topPose: "pointing",
        mainExpression: "serious",
        mainPose: "explaining",
        topNotes: "自信を持って注目ポイントを指さす",
        mainNotes: "落ち着いてデータを解説する雰囲気",
      }));
    } else if (type === "live") {
      setV((prev) => ({
        ...prev,
        edition: "just_before",
        topExpression: "serious",
        topPose: "pointing",
        mainExpression: "confident",
        mainPose: "energetic",
        mainCopy: "展示を見て、最後の判断！",
        topNotes: "直前情報を伝える集中した表情",
        mainNotes: "レース直前の勢いと期待感",
      }));
    }
  }

  async function loadAiPrediction(target = null) {
    setImportState({ status: "loading", message: "一果の前日AI予想を確認しています…", source: "manual" });
    try {
      const course = target?.courseName || v.course;
      const raceNo = String(target?.raceNo || v.raceNo);
      const timing = v.edition === "just_before" ? "after_exhibition" : "previous_day";
      const qs = new URLSearchParams({ date: v.date, course, raceNo, timing });
      const res = await fetch("/api/admin/ichika-news/prediction?" + qs.toString(), { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "load_failed");
      if (!json.found) {
        setImportState({ status: "empty", message: "このレースの一果・前日AI予想は見つかりませんでした。手動入力をそのまま使えます。", source: "manual" });
        return;
      }
      const d = json.data;
      const ticketText = (d.tickets || []).join(" / ");
      setV((prev) => ({
        ...prev,
        course,
        raceNo,
        escapeRate: d.escapeRate || prev.escapeRate,
        honmeiBoat: "1",
        honmeiTitle: "イン逃げで信頼度◎",
        honmeiComment: ticketText ? "前日AI公式買い目は " + ticketText + "。1号艇の逃げを軸に狙う構成。" : prev.honmeiComment,
        ichikaComment: d.socialComment || (d.escapeRate ? "前日AIではイン逃げ期待度" + d.escapeRate + "%。1号艇を中心に相手関係を見ていこう！" : prev.ichikaComment),
        aiTickets: d.tickets || [],
        aiUnitStake: d.unitStake || 0,
        aiInvestment: d.investment || 0,
        aiRankNo: d.rankNo || null,
      }));
      setImportState({ status: "loaded", message: (json.frozen ? "freeze済み公式予想" : "AI候補") + "を取得しました（BEST10 #" + d.rankNo + "）。取得後も手動修正できます。", source: json.frozen ? "ai_frozen" : "ai_candidate" });
    } catch {
      setImportState({ status: "error", message: "AI予想の取得に失敗しました。手動入力はそのまま利用できます。", source: "manual" });
    }
  }

  function switchToManual() {
    setImportState({ status: "idle", message: "手動入力モードです。", source: "manual" });
  }

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span>ICHIKA NEWSPAPER BUILDER</span>
            <h1>一果新聞 プロンプト作成</h1>
            <p>前日版・直前版の内容と、一果ちゃんの表情・ポーズを選んで画像生成プロンプトを作成します。</p>
          </div>
          <Link href="/admin" className={styles.back}>管理トップへ</Link>
        </header>

        <div className={styles.layout}>
          <section className={styles.formPanel}>
            <div className={styles.sectionTitle}>
              <div><span>01</span><h2>基本情報</h2></div>
              <div className={styles.editionSwitch}>
                <button type="button" className={v.edition === "previous_day" ? styles.active : ""} onClick={() => set("edition","previous_day")}>前日版</button>
                <button type="button" className={v.edition === "just_before" ? styles.active : ""} onClick={() => set("edition","just_before")}>直前版</button>
              </div>
            </div>

            <div className={styles.grid3}>
              <label><span>日付</span><input type="date" value={v.date} onChange={(e) => set("date",e.target.value)} /></label>
              <label><span>場名</span><select value={v.course} onChange={(e) => set("course",e.target.value)}>{STADIUMS.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label><span>レース</span><select value={v.raceNo} onChange={(e) => set("raceNo",e.target.value)}>{Array.from({length:12},(_,i) => <option key={i+1} value={String(i+1)}>{i+1}R</option>)}</select></label>
            </div>

            <NewsCandidatePicker character="ichika" date={v.date} edition={v.edition} onSelect={loadAiPrediction} />

            <div className={styles.importBox}>
              <div><span>DATA SOURCE</span><strong>{importState.source === "ai_frozen" ? "🟢 AI公式予想" : importState.source === "ai_candidate" ? "🟡 AI候補" : "✏️ 手動入力"}</strong><p>前日版は前日AI、直前版は展示後AIを読み込み、取得後も手動で修正できます。</p></div>
              <div className={styles.importActions}><button type="button" onClick={loadAiPrediction} disabled={importState.status === "loading"}>{importState.status === "loading" ? "確認中…" : "AI予想を読み込む"}</button><button type="button" className={styles.manualButton} onClick={switchToManual}>手動で編集</button></div>
              {importState.message && <div className={styles.importMessage}>{importState.message}</div>}
              {v.aiTickets?.length > 0 && <div className={styles.aiSnapshot}><b>取得した公式買い目</b><span>{v.aiTickets.join(" / ")}</span><small>1点 {v.aiUnitStake}円 ／ 投資 {v.aiInvestment}円</small></div>}
            </div>

            <label className={styles.full}><span>メインコピー</span><input value={v.mainCopy} onChange={(e) => set("mainCopy",e.target.value)} /></label>

            <div className={styles.grid2}>
              <label><span>このレースのイン逃げ率（%）</span><input inputMode="decimal" value={v.escapeRate} onChange={(e) => set("escapeRate",e.target.value)} /></label>
              <label><span>全国平均（%）</span><input inputMode="decimal" value={v.nationalAverage} onChange={(e) => set("nationalAverage",e.target.value)} /></label>
            </div>

            <label className={styles.full}><span>吹き出しコメント</span><textarea rows={2} value={v.speech} onChange={(e) => set("speech",e.target.value)} /></label>

            <div className={styles.sectionTitle}><div><span>02</span><h2>本命・コメント</h2></div></div>
            <div className={styles.grid3}>
              <label><span>本命艇</span><select value={v.honmeiBoat} onChange={(e) => set("honmeiBoat",e.target.value)}>{[1,2,3,4,5,6].map((n) => <option key={n} value={String(n)}>{n}号艇</option>)}</select></label>
              <label className={styles.span2}><span>本命見出し</span><input value={v.honmeiTitle} onChange={(e) => set("honmeiTitle",e.target.value)} /></label>
            </div>
            <label className={styles.full}><span>本命コメント</span><input value={v.honmeiComment} onChange={(e) => set("honmeiComment",e.target.value)} /></label>
            <label className={styles.full}><span>一果のひとこと</span><textarea rows={3} value={v.ichikaComment} onChange={(e) => set("ichikaComment",e.target.value)} /></label>

            {v.edition === "just_before" && (
              <>
                <div className={styles.sectionTitle}><div><span>03</span><h2>展示気配</h2></div><em>直前版のみ</em></div>
                <div className={styles.exhibitionGrid}>
                  <label><b>1号艇</b><textarea rows={2} value={v.exhibition1} onChange={(e) => set("exhibition1",e.target.value)} /></label>
                  <label><b>2号艇</b><textarea rows={2} value={v.exhibition2} onChange={(e) => set("exhibition2",e.target.value)} /></label>
                  <label><b>3号艇</b><textarea rows={2} value={v.exhibition3} onChange={(e) => set("exhibition3",e.target.value)} /></label>
                </div>
              </>
            )}

            <div className={styles.sectionTitle}><div><span>{v.edition === "just_before" ? "04" : "03"}</span><h2>一果ちゃん演出</h2></div></div>

            <div className={styles.presetRow}>
              <button type="button" onClick={() => preset("cheer")}>📣 元気・応援</button>
              <button type="button" onClick={() => preset("analysis")}>📊 しっかり解説</button>
              <button type="button" onClick={() => preset("live")}>⚡ 直前モード</button>
            </div>

            <div className={styles.characterGrid}>
              <article>
                <div className={styles.characterHead}><b>右上の一果ちゃん</b><span>TOP CHARACTER</span></div>
                <label><span>表情</span><select value={v.topExpression} onChange={(e) => set("topExpression",e.target.value)}>{EXPRESSIONS.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                <label><span>ポーズ</span><select value={v.topPose} onChange={(e) => set("topPose",e.target.value)}>{POSES.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                <label><span>演出補足</span><input value={v.topNotes} onChange={(e) => set("topNotes",e.target.value)} /></label>
              </article>

              <article>
                <div className={styles.characterHead}><b>本文側の一果ちゃん</b><span>MAIN CHARACTER</span></div>
                <label><span>表情</span><select value={v.mainExpression} onChange={(e) => set("mainExpression",e.target.value)}>{EXPRESSIONS.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                <label><span>ポーズ</span><select value={v.mainPose} onChange={(e) => set("mainPose",e.target.value)}>{POSES.map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                <label><span>演出補足</span><input value={v.mainNotes} onChange={(e) => set("mainNotes",e.target.value)} /></label>
              </article>
            </div>
          </section>

          <aside className={styles.outputPanel}>
            <div className={styles.sticky}>
              <section className={styles.summaryCard}>
                <span>NEWSPAPER PREVIEW</span>
                <h2>{shortDate(v.date)} {v.course}{v.raceNo}R</h2>
                <strong>{v.edition === "just_before" ? "直前版" : "前日版"}</strong>
                <div className={styles.bigRate}>{v.escapeRate || "—"}<small>%</small></div>
                <p>{v.mainCopy}</p>
                <div className={styles.characterSummary}>
                  <span>右上：{labelOf(EXPRESSIONS,v.topExpression)} × {labelOf(POSES,v.topPose)}</span>
                  <span>本文：{labelOf(EXPRESSIONS,v.mainExpression)} × {labelOf(POSES,v.mainPose)}</span>
                </div>
              </section>

              <section className={styles.outputCard}>
                <div className={styles.outputHead}><div><span>IMAGE PROMPT</span><h3>画像生成プロンプト</h3></div><button type="button" onClick={() => copy(prompt,"prompt")}>{copied === "prompt" ? "コピーしました" : "コピー"}</button></div>
                <textarea readOnly rows={24} value={prompt} />
              </section>

              <section className={styles.outputCard}>
                <div className={styles.outputHead}><div><span>X POST</span><h3>X投稿文</h3></div><button type="button" onClick={() => copy(xPost,"x")}>{copied === "x" ? "コピーしました" : "コピー"}</button></div>
                <textarea readOnly rows={7} value={xPost} />
                <small>{Array.from(xPost).length}文字</small>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
