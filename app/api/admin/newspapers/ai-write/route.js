import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../admin/sync/_lib/adminAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

const LENGTHS = {
  short: { site: "600〜900字", note: "1,050〜1,600字", tokens: 3200 },
  standard: { site: "850〜1,300字", note: "1,550〜2,450字", tokens: 4500 },
  detailed: { site: "1,200〜1,900字", note: "2,150〜3,500字", tokens: 6200 },
};

const PROFILES = {
  ichika: {
    name: "一果",
    role: "イン逃げ担当。落ち着いて論理的で、親しみやすい先生・解説役",
    focus: "1号艇のイン逃げを軸に、数字と直前情報を整理する",
    firstPrevious: "## 前日版｜一果の注目ポイント",
    firstBefore: "## 直前版｜展示後の一果チェック",
    dataPrevious: "## 前日データから見るこのレース",
    dataBefore: "## 展示データから見るこのレース",
    thirdPrevious: "## 直前版で確認したいこと",
    thirdBefore: "## 相手関係の最終チェック",
    summaryPrevious: "## 一果の前日まとめ",
    summaryBefore: "## 一果の直前まとめ",
  },
  hatsune: {
    name: "初音",
    role: "女子戦担当。やわらかく親しみやすく、女子戦の流れや注目艇を丁寧に整理する",
    focus: "女子戦期待度・注目艇・各艇評価・チェックポイントを使って、女子戦の見どころを分かりやすく伝える",
    firstPrevious: "## 前日版｜初音の女子戦チェック",
    firstBefore: "## 直前版｜初音の女子戦チェック",
    dataPrevious: "## 前日データから見る女子戦",
    dataBefore: "## 直前データから見る女子戦",
    thirdPrevious: "## 直前版で確認したいこと",
    thirdBefore: "## 相手関係の最終チェック",
    summaryPrevious: "## 初音の前日まとめ",
    summaryBefore: "## 初音の直前まとめ",
  },
  kiina: {
    name: "キイナ",
    role: "穴狙い担当。元気で少し攻めた語り口だが、根拠のない煽りはせず、穴条件を絞って説明する",
    focus: "注目穴・穴狙い期待度・各艇評価・買い目を使って、どこに穴の余地を見るかを分かりやすく伝える",
    firstPrevious: "## 前日版｜キイナの穴チェック",
    firstBefore: "## 直前版｜キイナの穴チェック",
    dataPrevious: "## 前日データから見る穴ポイント",
    dataBefore: "## 直前データから見る穴ポイント",
    thirdPrevious: "## 直前版で確認したいこと",
    thirdBefore: "## 穴候補の最終チェック",
    summaryPrevious: "## キイナの前日まとめ",
    summaryBefore: "## キイナの直前まとめ",
  },
};

function plain(value) {
  if (value === null || value === undefined || typeof value === "object") return "";
  return String(value).trim();
}

function numeric(value) {
  const raw = plain(value);
  return raw && /^-?\d+(?:\.\d+)?$/.test(raw) ? raw : "";
}

function safeStringArray(value, max = 20) {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.trim()).slice(0, max) : [];
}

function safeScores(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result = {};
  for (const boat of ["1","2","3","4","5","6"]) {
    const score = numeric(value[boat]);
    if (score) result[boat] = score;
  }
  return result;
}

function safeFacts(body) {
  const source = body?.source || {};
  const raw = body?.sourcePayload || {};
  const edition = plain(source.edition || raw.edition);
  const isJustBefore = edition === "just_before";

  return {
    date: plain(source.date || raw.date),
    course: plain(source.course || raw.course),
    raceNo: numeric(source.raceNo || raw.raceNo),
    edition,
    headline: plain(source.headline || raw.mainCopy || raw.headline),
    speech: plain(raw.speech),
    escapeRate: numeric(raw.escapeRate),
    nationalAverage: numeric(raw.nationalAverage),
    honmeiBoat: numeric(raw.honmeiBoat),
    honmeiTitle: plain(raw.honmeiTitle),
    honmeiComment: plain(raw.honmeiComment),
    ichikaComment: plain(raw.ichikaComment),
    expectation: numeric(raw.expectation),
    featuredBoat: numeric(raw.featuredBoat),
    hatsuneComment: plain(raw.comment),
    checkpoints: safeStringArray(raw.checkpoints, 6),
    aiCategory: plain(raw.aiCategory),
    holeBoat: numeric(raw.holeBoat),
    holeChance: numeric(raw.holeChance),
    callout: plain(raw.callout),
    kiinaComment: plain(raw.kiinaComment),
    scores: safeScores(raw.scores),
    ...(isJustBefore ? {
      exhibition1: plain(raw.exhibition1),
      exhibition2: plain(raw.exhibition2),
      exhibition3: plain(raw.exhibition3),
    } : {}),
    aiTickets: safeStringArray(raw.aiTickets, 20),
    aiUnitStake: Number.isFinite(Number(raw.aiUnitStake)) ? Number(raw.aiUnitStake) : null,
    aiInvestment: Number.isFinite(Number(raw.aiInvestment)) ? Number(raw.aiInvestment) : null,
  };
}

function outputText(json) {
  if (typeof json?.output_text === "string" && json.output_text.trim()) return json.output_text.trim();
  const parts = [];
  for (const item of json?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && typeof part.text === "string") parts.push(part.text);
    }
  }
  return parts.join("\n").trim();
}

function parseObject(value) {
  const cleaned = String(value || "").trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/i, "");
  return JSON.parse(cleaned);
}

function characterRules(character, edition) {
  const isJustBefore = edition === "just_before";
  if (character === "ichika") {
    return [
      "- 一果はイン逃げ担当。1号艇中心の見立てを、数字と入力済み情報から論理的に説明する",
      "- 『私がまず見たいのは』『私はここを確認したいです』など一人称を自然に使うが、各セクション1〜2回程度に抑える",
      isJustBefore
        ? "- 直前版で展示評価が入力されている場合は確認済み材料として扱う。展示前に時間を戻す表現は禁止"
        : "- 前日版では展示気配・展示タイム・スタート展示・進入を確定情報として書かない",
    ];
  }
  if (character === "hatsune") {
    return [
      "- 初音は女子戦担当。やわらかく親しみやすいが、幼すぎる言い回しや過度なハート表現は本文では控える",
      "- 女子戦期待度、注目艇、各艇評価、チェックポイント、分類が入力されていれば、それぞれの役割を整理して説明する",
      "- 女子選手の性格・実力・近況など、入力にない個人情報や評価を推測しない",
      "- 『流れ』『気配』という言葉だけで曖昧に済ませず、入力済みのチェックポイントや数値に結びつける",
      isJustBefore
        ? "- 直前版でも具体的な展示情報が入力されていない場合、展示内容を作らない。『直前データで評価が更新された』程度にとどめる"
        : "- 前日版では展示・進入・当日気配を確定情報として書かず、直前に確認する項目として扱う",
    ];
  }
  return [
    "- キイナは穴狙い担当。元気で少し攻めた口調にするが、煽りすぎず、穴を狙う理由を入力済みデータに結びつける",
    "- 注目穴、穴狙い期待度、各艇評価、買い目が入力されていれば、どこに穴の余地を見るのかを簡潔に説明する",
    "- 『絶対穴』『激アツ』『儲かる』など、根拠のない煽り・利益を期待させる断定は使わない",
    "- 5号艇が入力されていないのに5アタマ前提で書かない。注目穴と買い目は入力どおり扱う",
    isJustBefore
      ? "- 直前版でも具体的な展示情報が入力されていない場合、展示内容を作らない。直前データから穴候補を整理する"
      : "- 前日版では展示・進入・当日気配を確定情報として書かず、直前に確認する項目として扱う",
  ];
}

export async function POST(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY がVercelに設定されていません。" }, { status: 503 });

  const body = await request.json();
  const character = plain(body?.character);
  const profile = PROFILES[character];
  if (!profile) return NextResponse.json({ error: "対応していない新聞キャラクターです。" }, { status: 400 });

  const facts = safeFacts(body);
  if (!facts.date || !facts.course || !facts.raceNo) {
    return NextResponse.json({ error: "日付・場名・レース番号を入力してください。" }, { status: 400 });
  }

  const lengthKey = LENGTHS[body?.length] ? body.length : "standard";
  const target = LENGTHS[lengthKey];
  const isJustBefore = facts.edition === "just_before";
  const editionLabel = isJustBefore ? "直前版" : "前日版";
  const draft = body?.draft || {};

  const prompt = [
    `あなたはBoatStrikersの${profile.name}本人として、読者に語りかける一人称の記事を書きます。`,
    `役割：${profile.role}。`,
    `記事の中心：${profile.focus}。`,
    "以下の確認済み入力データだけを根拠に、サイト記事とnote記事を読みやすく編集してください。",
    "",
    "【全キャラ共通の絶対ルール】",
    "- 入力にない数値・選手情報・モーター情報・展示情報・気象・進入・オッズ・結果を推測して追加しない",
    "- 数値、場名、レース番号、買い目は変更しない",
    "- ユーザー入力のコメントを客観的事実へ格上げしない",
    "- AI v2 / shadow / model / raw / score / headline / input / source / sourcePayload / prompt など内部用語を本文に出さない",
    "- [object Object] を絶対に出さない",
    "- 舟券購入や利益を保証する表現を使わない",
    "- 同じ数値・結論・注意書きを別セクションで何度も繰り返さない",
    "- 文章は重複を削り、読み物としてテンポよく進める",
    "- 一人称は自然に使うが、毎段落『私』から始めない",
    "- 前日版と直前版は最初の見出しと導入文で違いが分かるようにする",
    "- 前日版では未確認の当日情報を未来形で扱う",
    "- 直前版は入力済みの直前データを材料にする。ただし入力されていない展示・進入・気象は作らない",
    "- まとめは本文の再説明ではなく、2〜3文程度の短い締めにする",
    "- Markdown見出しは ##、箇条書きは - を使用する",
    ...characterRules(character, facts.edition),
    "",
    "【サイト記事の構成】",
    isJustBefore ? profile.firstBefore : profile.firstPrevious,
    isJustBefore ? profile.dataBefore : profile.dataPrevious,
    isJustBefore ? profile.thirdBefore : profile.thirdPrevious,
    isJustBefore ? profile.summaryBefore : profile.summaryPrevious,
    `目安：${target.site}。短い段落を中心にし、${profile.name}本人の自然な記事として仕上げる。`,
    "",
    "【note記事の構成】",
    isJustBefore
      ? `導入文：『${profile.name}の直前版』であることが自然に伝わる1〜2文で始める`
      : `導入文：『${profile.name}の前日版』であることが自然に伝わる1〜2文で始める`,
    isJustBefore ? `## 今日の${profile.name}新聞｜直前版` : `## 今日の${profile.name}新聞｜前日版`,
    isJustBefore ? profile.firstBefore : profile.firstPrevious,
    isJustBefore ? profile.dataBefore : profile.dataPrevious,
    isJustBefore ? profile.thirdBefore : profile.thirdPrevious,
    isJustBefore ? profile.summaryBefore : profile.summaryPrevious,
    "最後にBoatStrikersサイトで出走表・直前版・過去新聞を確認できる旨を自然に案内する。",
    `目安：${target.note}。サイト記事より丁寧にしつつ、同じ数値や注意点の再説明は避ける。`,
    "",
    "【確認済み入力データ】",
    JSON.stringify({ ...facts, editionLabel, character: profile.name }, null, 2),
    "",
    "【現在のテンプレート原稿】",
    JSON.stringify({
      title: plain(draft.title),
      summary: plain(draft.summary),
      articleBody: plain(draft.articleBody),
      noteTitle: plain(draft.noteTitle),
      noteBody: plain(draft.noteBody),
    }, null, 2),
    "",
    "次のJSONだけを返してください。Markdownコードフェンスは不要です。",
    JSON.stringify({
      summary: "サイト用の短い要約。120〜220字程度",
      articleBody: "サイト記事本文",
      noteTitle: "note記事タイトル",
      noteBody: "note記事本文",
    }, null, 2),
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_NEWSPAPER_MODEL?.trim() || "gpt-5.6-luna",
      input: prompt,
      reasoning: { effort: "low" },
      max_output_tokens: target.tokens,
    }),
    signal: AbortSignal.timeout(55000),
  });

  const json = await response.json();
  if (!response.ok) {
    console.error("新聞AI生成エラー:", json?.error?.message || response.status);
    return NextResponse.json({ error: json?.error?.message || "AI記事生成に失敗しました。" }, { status: 502 });
  }

  try {
    const output = parseObject(outputText(json));
    const result = {
      summary: plain(output.summary),
      articleBody: plain(output.articleBody),
      noteTitle: plain(output.noteTitle),
      noteBody: plain(output.noteBody),
    };
    if (!result.articleBody || !result.noteBody) throw new Error("empty_output");
    return NextResponse.json({ ok: true, result, length: lengthKey });
  } catch (error) {
    console.error("新聞AI生成JSON解析エラー:", error);
    return NextResponse.json({ error: "AI出力の解析に失敗しました。もう一度生成してください。" }, { status: 502 });
  }
}
