"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./page.module.css";
import NewsCandidatePicker from "../news-candidate-picker/NewsCandidatePicker";
import NewspaperPublishingPanel from "../components/NewspaperPublishingPanel";

const STADIUMS = ["桐生","戸田","江戸川","平和島","多摩川","浜名湖","蒲郡","常滑","津","三国","びわこ","住之江","尼崎","鳴門","丸亀","児島","宮島","徳山","下関","若松","芦屋","福岡","唐津","大村"];

const EXPRESSIONS = [
  ["smile","にっこり笑顔"],
  ["wink","ウインク"],
  ["cute","かわいい笑顔"],
  ["cheerful","元気"],
  ["serious","真剣"],
  ["confident","自信あり"],
  ["surprised","驚き"],
  ["thinking","考え中"],
];

const POSES = [
  ["open_hand","手を差し出す"],
  ["cheering","応援ポーズ"],
  ["hands_cheeks","両手を頬に添える"],
  ["pointing","指さし"],
  ["explaining","解説ポーズ"],
  ["waving","手を振る"],
  ["hands_clasped","両手を胸の前で握る"],
  ["energetic","元気に片手を上げる"],
];

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function shortDate(value) {
  if (!value) return "";
  const [,m,d] = value.split("-");
  return Number(m) + "/" + Number(d);
}
function labelOf(options, value) {
  return options.find(([key]) => key === value)?.[1] || value;
}
function clampScore(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return String(Math.max(0,Math.min(100,Math.round(n))));
}

const DEFAULTS = {
  date: todayJst(),
  course: "宮島",
  raceNo: "1",
  edition: "previous_day",
  headline: "初音の女子戦予想",
  featuredBoat: "1",
  expectation: "70",
  comment: "女子戦は流れと気配に注目だよ♪",
  speech: "ボートでみんなを笑顔に…♡",
  checkpoints: ["スタート気配をチェック","ターン後の伸びをチェック","女子戦ならではの流れをチェック"],
  scores: {1:"72",2:"66",3:"64",4:"61",5:"58",6:"56"},
  topExpression: "wink",
  topPose: "open_hand",
  topNotes: "明るくかわいく、読者を応援する雰囲気",
  mainExpression: "cute",
  mainPose: "hands_cheeks",
  mainNotes: "親しみやすく女子戦を解説する雰囲気",
  aiTickets: [],
  aiUnitStake: 0,
  aiInvestment: 0,
  aiRankNo: null,
  aiCategory: "",
};

function buildPrompt(v){
  const edition = v.edition === "just_before" ? "直前版" : "前日版";
  const scoreLines = [1,2,3,4,5,6].map((n)=>"・"+n+"号艇："+(v.scores[n]||"—")+"/100").join("\n");
  const checkLines = v.checkpoints.map((x,i)=>"・"+(i+1)+"："+(x||"未入力")).join("\n");
  const tickets = v.aiTickets?.length ? "\n【取得済み公式買い目】\n・"+v.aiTickets.join(" / ")+"\n・1点 "+v.aiUnitStake+"円 / 投資 "+v.aiInvestment+"円\n※買い目は入力どおり表示し、推測で変更しない。" : "";
  const category = v.aiCategory ? "\n【AI分類】\n・"+v.aiCategory : "";

  return [
    "添付した「初音ちゃん新聞」のテンプレートをベースに、BoatStrikersの初音新聞を作成してください。",
    "",
    "【基本情報】",
    "・日付："+v.date,
    "・表示日付："+shortDate(v.date),
    "・場名："+v.course,
    "・レース："+v.raceNo+"R",
    "・版："+edition,
    "",
    "【最重要】",
    "・初音ちゃんの紫系の髪色、青〜紫系の目、ピンク系衣装、うさぎモチーフ、デフォルメ感、BoatStrikersのキャラクター性を維持する",
    "・紫、ピンク、白を基調とした、かわいくて女子戦らしい学級新聞風デザインを維持する",
    "・情報量を整理し、注目艇・女子戦期待度・要チェックポイントが一瞬で分かるようにする",
    "・場名、レース番号、数値、コメント、買い目は下記入力内容だけを使用し、推測で補完しない",
    "・AI v2、shadow、model、raw、scoreなど内部用モデル名・内部指標名は表示しない",
    "・[object Object]を絶対に表示しない",
    "・日本語を読みやすく、文字崩れを避ける",
    "",
    "【上部ヘッダー】",
    shortDate(v.date)+" "+v.course+v.raceNo+"R "+edition,
    "",
    "【見出し】",
    v.headline,
    "",
    "【注目】",
    "・注目艇："+v.featuredBoat+"号艇",
    "",
    "【女子戦期待度】",
    "・"+(v.expectation||"—")+"%",
    "",
    "【初音のひとこと】",
    v.comment,
    "",
    "【吹き出し】",
    v.speech,
    "",
    "【要チェックポイント】",
    checkLines,
    "",
    "【各艇評価】",
    scoreLines,
    category,
    tickets,
    "",
    "【初音ちゃんの演出】",
    "■ 右上キャラクター",
    "・表情："+labelOf(EXPRESSIONS,v.topExpression),
    "・ポーズ："+labelOf(POSES,v.topPose),
    "・補足："+v.topNotes,
    "",
    "■ 本文側キャラクター",
    "・表情："+labelOf(EXPRESSIONS,v.mainExpression),
    "・ポーズ："+labelOf(POSES,v.mainPose),
    "・補足："+v.mainNotes,
    "",
    "【レイアウト】",
    "・上段：BoatStrikersロゴ、初音ちゃん新聞、日付 / 場名 / レース / 版",
    "・中央左：注目艇を大きく表示",
    "・中央右：女子戦期待度を大きく表示",
    "・中段左：初音のひとこと",
    "・下段左：要チェックポイント3つ",
    "・右側：1〜6号艇の各艇評価",
    "・ハート、うさぎ、ノート風装飾を使い、女子戦らしい柔らかさを出す",
    "・かわいさ優先でも情報の視認性を落とさない"
  ].join("\n");
}

function buildXPost(v){
  const edition = v.edition === "just_before" ? "直前版" : "前日版";
  return [
    "💜 初音ちゃん新聞｜"+shortDate(v.date)+" "+v.course+v.raceNo+"R "+edition,
    "注目は"+v.featuredBoat+"号艇。女子戦期待度 "+(v.expectation||"—")+"%",
    v.comment,
    "#BoatStrikers #ボートレース #女子戦"
  ].join("\n");
}

export default function HatsuneNewsAdmin(){
  const [v,setV] = useState(DEFAULTS);
  const [copied,setCopied] = useState("");
  const [importState,setImportState] = useState({status:"idle",message:"",source:"manual"});

  const prompt = useMemo(()=>buildPrompt(v),[v]);
  const xPost = useMemo(()=>buildXPost(v),[v]);

  function set(key,value){ setV((prev)=>({...prev,[key]:value})); }
  function setScore(boat,value){ setV((prev)=>({...prev,scores:{...prev.scores,[boat]:clampScore(value)}})); }
  function setCheckpoint(index,value){ setV((prev)=>({...prev,checkpoints:prev.checkpoints.map((x,i)=>i===index?value:x)})); }

  async function loadAiPrediction(target = null){
    setImportState({status:"loading",message:"初音のAI予想を確認しています…",source:"manual"});
    try{
      const timing = v.edition === "just_before" ? "after_exhibition" : "previous_day";
      const course = target?.courseName || v.course;
      const raceNo = String(target?.raceNo || v.raceNo);
      const qs = new URLSearchParams({date:v.date,course,raceNo,timing});
      const res = await fetch("/api/admin/hatsune-news/prediction?"+qs.toString(),{cache:"no-store"});
      const json = await res.json();
      if(!res.ok || !json.ok) throw new Error(json.error||"load_failed");
      if(!json.found){
        setImportState({status:"empty",message:"このレースの初音AI予想は見つかりませんでした。手動入力をそのまま使えます。",source:"manual"});
        return;
      }
      const d = json.data;
      setV((prev)=>({
        ...prev,
        course,
        raceNo,
        expectation:d.expectation||prev.expectation,
        aiCategory:d.category||"",
        comment:d.socialComment || (d.category === "インが不安"
          ? "インが不安な女子戦。流れが変わる展開に注目だよ♪"
          : "イン優勢の女子戦。軸を決めて相手の気配を見ていこう♪"),
        checkpoints:d.category === "インが不安"
          ? ["1号艇のスタート気配","2〜4号艇の攻め足","まくり差しの展開"]
          : ["1号艇の行き足","相手候補の差し足","スタート隊形"],
        aiTickets:d.tickets||[],
        aiUnitStake:d.unitStake||0,
        aiInvestment:d.investment||0,
        aiRankNo:d.rankNo||null
      }));
      setImportState({
        status:"loaded",
        message:(json.frozen?"freeze済み公式予想":"AI候補")+"を取得しました（"+d.category+" / BEST3 #"+d.rankNo+"）。取得後も手動修正できます。",
        source:json.frozen?"ai_frozen":"ai_candidate"
      });
    }catch{
      setImportState({status:"error",message:"AI予想の取得に失敗しました。手動入力はそのまま利用できます。",source:"manual"});
    }
  }

  async function copy(text,key){
    try{ await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(()=>setCopied(""),1600); }catch{}
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div><span>HATSUNE NEWSPAPER BUILDER</span><h1>初音新聞 プロンプト作成</h1><p>女子戦新聞を、AI自動取得と手動入力の両方で作成できます。</p></div>
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

            <NewsCandidatePicker character="hatsune" date={v.date} edition={v.edition} onSelect={loadAiPrediction} />

            <div className={styles.importBox}>
              <div><span>DATA SOURCE</span><strong>{importState.source==="ai_frozen"?"🟣 AI公式予想":importState.source==="ai_candidate"?"🟪 AI候補":"✏️ 手動入力"}</strong><p>前日版は前日AI、直前版は展示後AIを読み込みます。「イン逃げが圧倒的 / インが不安」も自動判定します。</p></div>
              <div className={styles.importActions}><button type="button" onClick={loadAiPrediction} disabled={importState.status==="loading"}>{importState.status==="loading"?"確認中…":"AI予想を読み込む"}</button><button type="button" className={styles.manualButton} onClick={()=>setImportState({status:"idle",message:"手動入力モードです。",source:"manual"})}>手動で編集</button></div>
              {importState.message && <div className={styles.importMessage}>{importState.message}</div>}
              {v.aiCategory && <div className={styles.categoryBadge}>AI分類：<b>{v.aiCategory}</b></div>}
              {v.aiTickets.length>0 && <div className={styles.aiSnapshot}><b>取得した公式買い目</b><span>{v.aiTickets.join(" / ")}</span><small>1点 {v.aiUnitStake}円 ／ 投資 {v.aiInvestment}円</small></div>}
            </div>

            <label className={styles.full}><span>新聞見出し</span><input value={v.headline} onChange={(e)=>set("headline",e.target.value)} /></label>

            <div className={styles.sectionTitle}><div><span>02</span><h2>女子戦情報</h2></div></div>
            <div className={styles.grid2}>
              <label><span>注目艇</span><select value={v.featuredBoat} onChange={(e)=>set("featuredBoat",e.target.value)}>{[1,2,3,4,5,6].map((n)=><option key={n} value={String(n)}>{n}号艇</option>)}</select></label>
              <label><span>女子戦期待度（%）</span><input inputMode="decimal" value={v.expectation} onChange={(e)=>set("expectation",e.target.value)} /></label>
            </div>
            <label className={styles.full}><span>初音のひとこと</span><textarea rows={3} value={v.comment} onChange={(e)=>set("comment",e.target.value)} /></label>
            <label className={styles.full}><span>吹き出し</span><input value={v.speech} onChange={(e)=>set("speech",e.target.value)} /></label>

            <div className={styles.sectionTitle}><div><span>03</span><h2>要チェックポイント</h2></div></div>
            <div className={styles.checkGrid}>{v.checkpoints.map((x,i)=><label key={i}><b>{i+1}</b><input value={x} onChange={(e)=>setCheckpoint(i,e.target.value)} /></label>)}</div>

            <div className={styles.sectionTitle}><div><span>04</span><h2>各艇評価</h2></div><em>0〜100</em></div>
            <div className={styles.scoreGrid}>{[1,2,3,4,5,6].map((n)=><label key={n}><b>{n}号艇</b><input inputMode="numeric" value={v.scores[n]} onChange={(e)=>setScore(n,e.target.value)} /><span>/100</span></label>)}</div>

            <div className={styles.sectionTitle}><div><span>05</span><h2>初音ちゃん演出</h2></div></div>
            <div className={styles.characterGrid}>
              <article><div className={styles.characterHead}><b>右上の初音ちゃん</b><span>TOP</span></div><label><span>表情</span><select value={v.topExpression} onChange={(e)=>set("topExpression",e.target.value)}>{EXPRESSIONS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label><span>ポーズ</span><select value={v.topPose} onChange={(e)=>set("topPose",e.target.value)}>{POSES.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label><span>補足</span><input value={v.topNotes} onChange={(e)=>set("topNotes",e.target.value)} /></label></article>
              <article><div className={styles.characterHead}><b>本文側の初音ちゃん</b><span>MAIN</span></div><label><span>表情</span><select value={v.mainExpression} onChange={(e)=>set("mainExpression",e.target.value)}>{EXPRESSIONS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label><span>ポーズ</span><select value={v.mainPose} onChange={(e)=>set("mainPose",e.target.value)}>{POSES.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label><span>補足</span><input value={v.mainNotes} onChange={(e)=>set("mainNotes",e.target.value)} /></label></article>
            </div>
          </section>

          <aside className={styles.outputPanel}>
            <div className={styles.sticky}>
              <section className={styles.summaryCard}><span>NEWSPAPER PREVIEW</span><h2>{shortDate(v.date)} {v.course}{v.raceNo}R</h2><strong>{v.edition==="just_before"?"直前版":"前日版"}</strong><div className={styles.featured}>{v.featuredBoat}<small>号艇</small></div><div className={styles.expectation}>{v.expectation||"—"}%</div><p>{v.comment}</p></section>
              <section className={styles.outputCard}><div className={styles.outputHead}><div><span>IMAGE PROMPT</span><h3>画像生成プロンプト</h3></div><button type="button" onClick={()=>copy(prompt,"prompt")}>{copied==="prompt"?"コピーしました":"コピー"}</button></div><textarea readOnly rows={27} value={prompt} /></section>
              <section className={styles.outputCard}><div className={styles.outputHead}><div><span>X POST</span><h3>X投稿文</h3></div><button type="button" onClick={()=>copy(xPost,"x")}>{copied==="x"?"コピーしました":"コピー"}</button></div><textarea readOnly rows={7} value={xPost} /><small>{Array.from(xPost).length}文字</small></section>
            </div>
          </aside>
        </div>
      </div>
      <NewspaperPublishingPanel character="hatsune" value={v} />
    </main>
  );
}
