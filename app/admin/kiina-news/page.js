"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./page.module.css";
import NewsCandidatePicker from "../news-candidate-picker/NewsCandidatePicker";
import NewspaperPublishingPanel from "../components/NewspaperPublishingPanel";

const STADIUMS = ["桐生","戸田","江戸川","平和島","多摩川","浜名湖","蒲郡","常滑","津","三国","びわこ","住之江","尼崎","鳴門","丸亀","児島","宮島","徳山","下関","若松","芦屋","福岡","唐津","大村"];

const EXPRESSIONS = [
  ["wink","ウインク"],
  ["smile","にっこり笑顔"],
  ["cheerful","元気な笑顔"],
  ["confident","自信あり"],
  ["serious","真剣"],
  ["surprised","驚き"],
  ["thinking","考え中"],
  ["excited","ワクワク"],
];

const POSES = [
  ["pointing","指さし"],
  ["thumbs_up","親指を立てる"],
  ["fists_up","ガッツポーズ"],
  ["cheering","応援ポーズ"],
  ["hand_on_hip","片手を腰に当てる"],
  ["explaining","解説ポーズ"],
  ["waving","手を振る"],
  ["energetic","元気に片手を上げる"],
];

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
}
function shortDate(value) {
  if (!value) return "";
  const parts = value.split("-");
  return Number(parts[1]) + "/" + Number(parts[2]);
}
function labelOf(options, value) {
  return options.find(([key]) => key === value)?.[1] || value;
}
function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return String(Math.max(0, Math.min(100, Math.round(n))));
}

const DEFAULTS = {
  date: todayJst(),
  course: "宮島",
  raceNo: "1",
  edition: "previous_day",
  headline: "キイナの穴狙い予想",
  holeBoat: "5",
  holeChance: "16",
  callout: "ここが狙い目！",
  speech: "穴で一発狙っちゃおう！",
  kiinaComment: "本命だけじゃもったいない！穴候補の気配と展開を見て狙っていこう！",
  scores: {1:"60",2:"55",3:"58",4:"62",5:"78",6:"57"},
  topExpression: "wink",
  topPose: "thumbs_up",
  topNotes: "元気に読者へ穴狙いをアピール",
  mainExpression: "cheerful",
  mainPose: "fists_up",
  mainNotes: "ワクワク感のある明るい雰囲気",
  aiTickets: [],
  aiUnitStake: 0,
  aiInvestment: 0,
  aiRankNo: null,
};

function buildPrompt(v) {
  const edition = v.edition === "just_before" ? "直前版" : "前日版";
  const timingNote = v.edition === "just_before" ? "直前版として、展示後データを反映した紙面にする" : "前日版として、前日AI予想を反映した紙面にする";
  const scoreLines = [1,2,3,4,5,6].map((n) => "・" + n + "号艇：" + (v.scores[n] || "—") + "/100").join("\n");
  const tickets = v.aiTickets?.length ? "\n【取得済み公式買い目】\n・" + v.aiTickets.join(" / ") + "\n・1点 " + v.aiUnitStake + "円 / 投資 " + v.aiInvestment + "円\n※買い目は入力どおり表示し、推測で追加・変更しない。" : "";

  return [
    "添付した「キイナちゃん新聞」のテンプレートをベースに、BoatStrikersのキイナ新聞を作成してください。",
    "",
    "【基本情報】",
    "・日付：" + v.date,
    "・表示日付：" + shortDate(v.date),
    "・場名：" + v.course,
    "・レース：" + v.raceNo + "R",
    "・版：" + edition,
    "",
    "【最重要】",
    "・キイナちゃんの黄色〜ゴールド系の髪色、顔立ち、目、衣装、デフォルメ感、BoatStrikersのキャラクター性を維持する",
    "・黄色、黒、白を基調とした、元気で少し攻めた学級新聞風デザインを維持する",
    "・情報量を絞り、注目穴と穴狙い期待度が一瞬で分かるようにする",
    "・場名、レース番号、数値、コメント、買い目は下記入力内容だけを使用し、推測で補完しない",
    "・AI v2、shadow、model、raw、scoreなど内部用モデル名・内部指標名は表示しない",
    "・[object Object]を絶対に表示しない",
    "・日本語の文字崩れを避ける",
    "",
    "【上部ヘッダー】",
    shortDate(v.date) + " " + v.course + v.raceNo + "R " + edition,
    "",
    "【見出し】",
    v.headline,
    "",
    "【注目穴】",
    "・注目穴：" + v.holeBoat + "号艇",
    "・見出し：" + v.callout,
    "",
    "【穴狙い期待度】",
    "・" + (v.holeChance || "—") + "%",
    "",
    "【キイナのひとこと】",
    v.kiinaComment,
    "",
    "【吹き出し】",
    v.speech,
    "",
    "【各艇評価】",
    scoreLines,
    tickets,
    "",
    "【キイナちゃんの演出】",
    "■ 右上キャラクター",
    "・表情：" + labelOf(EXPRESSIONS, v.topExpression),
    "・ポーズ：" + labelOf(POSES, v.topPose),
    "・補足：" + v.topNotes,
    "",
    "■ 本文側キャラクター",
    "・表情：" + labelOf(EXPRESSIONS, v.mainExpression),
    "・ポーズ：" + labelOf(POSES, v.mainPose),
    "・補足：" + v.mainNotes,
    "",
    "【版の扱い】",
    "・" + timingNote,
    "",
    "【レイアウト】",
    "・上段：BoatStrikersロゴ、キイナちゃん新聞、日付 / 場名 / レース / 版",
    "・中央左：注目穴を大きく表示",
    "・中央右：穴狙い期待度を大きく表示",
    "・中段：キイナのひとこと + 本文側キャラクター",
    "・下段：1〜6号艇の各艇評価を横バーで表示",
    "・黄色のマーカー風装飾、黒太字、星モチーフを活用する",
    "・情報を詰め込みすぎず、SNSで一瞬で読める紙面にする"
  ].join("\n");
}

function buildXPost(v) {
  const edition = v.edition === "just_before" ? "直前版" : "前日版";
  return [
    "🟡 キイナちゃん新聞｜" + shortDate(v.date) + " " + v.course + v.raceNo + "R " + edition,
    "注目穴は" + v.holeBoat + "号艇。穴狙い期待度 " + (v.holeChance || "—") + "%",
    v.kiinaComment,
    "#BoatStrikers #ボートレース"
  ].join("\n");
}

export default function KiinaNewsAdmin() {
  const [v, setV] = useState(DEFAULTS);
  const [copied, setCopied] = useState("");
  const [importState, setImportState] = useState({status:"idle",message:"",source:"manual"});

  const prompt = useMemo(() => buildPrompt(v), [v]);
  const xPost = useMemo(() => buildXPost(v), [v]);

  function set(key, value) {
    setV((prev) => ({...prev,[key]:value}));
  }
  function setScore(boat, value) {
    setV((prev) => ({...prev,scores:{...prev.scores,[boat]:clampScore(value)}}));
  }

  async function loadAiPrediction(target = null) {
    setImportState({status:"loading",message:"キイナのAI予想を確認しています…",source:"manual"});
    try {
      const timing = v.edition === "just_before" ? "after_exhibition" : "previous_day";
      const course = target?.courseName || v.course;
      const raceNo = String(target?.raceNo || v.raceNo);
      const qs = new URLSearchParams({date:v.date,course,raceNo,timing});
      const res = await fetch("/api/admin/kiina-news/prediction?" + qs.toString(), {cache:"no-store"});
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "load_failed");
      if (!json.found) {
        setImportState({status:"empty",message:"このレースのキイナAI予想は見つかりませんでした。手動入力をそのまま使えます。",source:"manual"});
        return;
      }
      const d = json.data;
      setV((prev) => ({
        ...prev,
        course,
        raceNo,
        holeBoat: d.holeBoat || prev.holeBoat,
        holeChance: d.chance || prev.holeChance,
        kiinaComment: d.socialComment || (d.chance ? "AIでは" + d.holeBoat + "号艇の穴期待度が" + d.chance + "%。展開がハマれば一発に期待！" : prev.kiinaComment),
        aiTickets: d.tickets || [],
        aiUnitStake: d.unitStake || 0,
        aiInvestment: d.investment || 0,
        aiRankNo: d.rankNo || null,
        scores: {...prev.scores,[d.holeBoat || "5"]: d.chance ? String(Math.max(Number(prev.scores[d.holeBoat || "5"] || 0), Math.min(100, Math.round(Number(d.chance) * 5)))) : prev.scores[d.holeBoat || "5"]}
      }));
      setImportState({
        status:"loaded",
        message:(json.frozen ? "freeze済み公式予想" : "AI候補") + "を取得しました（BEST5 #" + d.rankNo + "）。取得後もすべて手動修正できます。",
        source:json.frozen ? "ai_frozen" : "ai_candidate"
      });
    } catch {
      setImportState({status:"error",message:"AI予想の取得に失敗しました。手動入力はそのまま利用できます。",source:"manual"});
    }
  }

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {}
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div><span>KIINA NEWSPAPER BUILDER</span><h1>キイナ新聞 プロンプト作成</h1><p>穴狙い新聞を、AI自動取得と手動入力の両方で作成できます。</p></div>
          <Link href="/admin" className={styles.back}>管理トップへ</Link>
        </header>

        <div className={styles.layout}>
          <section className={styles.formPanel}>
            <div className={styles.sectionTitle}>
              <div><span>01</span><h2>基本情報</h2></div>
              <div className={styles.editionSwitch}>
                <button type="button" className={v.edition==="previous_day"?styles.active:""} onClick={()=>set("edition","previous_day")}>前日版</button>
                <button type="button" className={v.edition==="just_before"?styles.active:""} onClick={()=>set("edition","just_before")}>直前版</button>
              </div>
            </div>

            <div className={styles.grid3}>
              <label><span>日付</span><input type="date" value={v.date} onChange={(e)=>set("date",e.target.value)} /></label>
              <label><span>場名</span><select value={v.course} onChange={(e)=>set("course",e.target.value)}>{STADIUMS.map((s)=><option key={s}>{s}</option>)}</select></label>
              <label><span>レース</span><select value={v.raceNo} onChange={(e)=>set("raceNo",e.target.value)}>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1)}>{i+1}R</option>)}</select></label>
            </div>

            <NewsCandidatePicker character="kiina" date={v.date} edition={v.edition} onSelect={loadAiPrediction} />

            <div className={styles.importBox}>
              <div><span>DATA SOURCE</span><strong>{importState.source==="ai_frozen"?"🟢 AI公式予想":importState.source==="ai_candidate"?"🟡 AI候補":"✏️ 手動入力"}</strong><p>選択中の版に合わせて、前日版は前日AI、直前版は展示後AIを読み込みます。</p></div>
              <div className={styles.importActions}><button type="button" onClick={loadAiPrediction} disabled={importState.status==="loading"}>{importState.status==="loading"?"確認中…":"AI予想を読み込む"}</button><button type="button" className={styles.manualButton} onClick={()=>setImportState({status:"idle",message:"手動入力モードです。",source:"manual"})}>手動で編集</button></div>
              {importState.message && <div className={styles.importMessage}>{importState.message}</div>}
              {v.aiTickets.length>0 && <div className={styles.aiSnapshot}><b>取得した公式買い目</b><span>{v.aiTickets.join(" / ")}</span><small>1点 {v.aiUnitStake}円 ／ 投資 {v.aiInvestment}円</small></div>}
            </div>

            <label className={styles.full}><span>新聞見出し</span><input value={v.headline} onChange={(e)=>set("headline",e.target.value)} /></label>

            <div className={styles.sectionTitle}><div><span>02</span><h2>穴狙い情報</h2></div></div>
            <div className={styles.grid2}>
              <label><span>注目穴</span><select value={v.holeBoat} onChange={(e)=>set("holeBoat",e.target.value)}>{[1,2,3,4,5,6].map((n)=><option key={n} value={String(n)}>{n}号艇</option>)}</select></label>
              <label><span>穴狙い期待度（%）</span><input inputMode="decimal" value={v.holeChance} onChange={(e)=>set("holeChance",e.target.value)} /></label>
            </div>
            <label className={styles.full}><span>注目穴見出し</span><input value={v.callout} onChange={(e)=>set("callout",e.target.value)} /></label>
            <label className={styles.full}><span>吹き出し</span><input value={v.speech} onChange={(e)=>set("speech",e.target.value)} /></label>
            <label className={styles.full}><span>キイナのひとこと</span><textarea rows={3} value={v.kiinaComment} onChange={(e)=>set("kiinaComment",e.target.value)} /></label>

            <div className={styles.sectionTitle}><div><span>03</span><h2>各艇評価</h2></div><em>0〜100</em></div>
            <div className={styles.scoreGrid}>
              {[1,2,3,4,5,6].map((n)=><label key={n}><b>{n}号艇</b><input inputMode="numeric" value={v.scores[n]} onChange={(e)=>setScore(n,e.target.value)} /><span>/100</span></label>)}
            </div>

            <div className={styles.sectionTitle}><div><span>04</span><h2>キイナちゃん演出</h2></div></div>
            <div className={styles.characterGrid}>
              <article><div className={styles.characterHead}><b>右上のキイナちゃん</b><span>TOP</span></div><label><span>表情</span><select value={v.topExpression} onChange={(e)=>set("topExpression",e.target.value)}>{EXPRESSIONS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label><span>ポーズ</span><select value={v.topPose} onChange={(e)=>set("topPose",e.target.value)}>{POSES.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label><span>補足</span><input value={v.topNotes} onChange={(e)=>set("topNotes",e.target.value)} /></label></article>
              <article><div className={styles.characterHead}><b>本文側のキイナちゃん</b><span>MAIN</span></div><label><span>表情</span><select value={v.mainExpression} onChange={(e)=>set("mainExpression",e.target.value)}>{EXPRESSIONS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label><span>ポーズ</span><select value={v.mainPose} onChange={(e)=>set("mainPose",e.target.value)}>{POSES.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label><span>補足</span><input value={v.mainNotes} onChange={(e)=>set("mainNotes",e.target.value)} /></label></article>
            </div>
          </section>

          <aside className={styles.outputPanel}>
            <div className={styles.sticky}>
              <section className={styles.summaryCard}><span>NEWSPAPER PREVIEW</span><h2>{shortDate(v.date)} {v.course}{v.raceNo}R</h2><strong>{v.edition==="just_before"?"直前版":"前日版"}</strong><div className={styles.holeBoat}>{v.holeBoat}<small>号艇</small></div><div className={styles.chance}>{v.holeChance||"—"}%</div><p>{v.kiinaComment}</p></section>
              <section className={styles.outputCard}><div className={styles.outputHead}><div><span>IMAGE PROMPT</span><h3>画像生成プロンプト</h3></div><button type="button" onClick={()=>copy(prompt,"prompt")}>{copied==="prompt"?"コピーしました":"コピー"}</button></div><textarea readOnly rows={26} value={prompt} /></section>
              <section className={styles.outputCard}><div className={styles.outputHead}><div><span>X POST</span><h3>X投稿文</h3></div><button type="button" onClick={()=>copy(xPost,"x")}>{copied==="x"?"コピーしました":"コピー"}</button></div><textarea readOnly rows={7} value={xPost} /><small>{Array.from(xPost).length}文字</small></section>
            </div>
          </aside>
        </div>
      </div>
      <NewspaperPublishingPanel character="kiina" value={v} />
    </main>
  );
}
