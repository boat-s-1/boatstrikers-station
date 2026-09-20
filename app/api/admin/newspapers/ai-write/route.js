import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../admin/sync/_lib/adminAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

const LENGTHS = {
  short: { site: "700〜1,000字", note: "1,200〜1,800字", tokens: 3500 },
  standard: { site: "1,000〜1,500字", note: "1,800〜2,800字", tokens: 5000 },
  detailed: { site: "1,400〜2,200字", note: "2,500〜4,000字", tokens: 7000 },
};

function plain(value) {
  if (value === null || value === undefined || typeof value === "object") return "";
  return String(value).trim();
}

function numeric(value) {
  const raw = plain(value);
  return raw && /^-?\\d+(?:\\.\\d+)?$/.test(raw) ? raw : "";
}

function safeFacts(body) {
  const source = body?.source || {};
  const raw = body?.sourcePayload || {};
  return {
    date: plain(source.date || raw.date),
    course: plain(source.course || raw.course),
    raceNo: numeric(source.raceNo || raw.raceNo),
    edition: plain(source.edition || raw.edition),
    headline: plain(source.headline || raw.mainCopy),
    escapeRate: numeric(raw.escapeRate),
    nationalAverage: numeric(raw.nationalAverage),
    honmeiBoat: numeric(raw.honmeiBoat),
    honmeiTitle: plain(raw.honmeiTitle),
    honmeiComment: plain(raw.honmeiComment),
    ichikaComment: plain(raw.ichikaComment),
    speech: plain(raw.speech),
    exhibition1: plain(raw.exhibition1),
    exhibition2: plain(raw.exhibition2),
    exhibition3: plain(raw.exhibition3),
    aiTickets: Array.isArray(raw.aiTickets) ? raw.aiTickets.filter((v) => typeof v === "string").slice(0, 20) : [],
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
  return parts.join("\\n").trim();
}

function parseObject(value) {
  const cleaned = String(value || "").trim().replace(/^\\x60\\x60\\x60(?:json)?\\s*/i, "").replace(/\\s*\\x60\\x60\\x60$/i, "");
  return JSON.parse(cleaned);
}

export async function POST(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY がVercelに設定されていません。" }, { status: 503 });

  const body = await request.json();
  if (body?.character !== "ichika") {
    return NextResponse.json({ error: "現在は一果新聞のみAI記事生成に対応しています。" }, { status: 400 });
  }

  const facts = safeFacts(body);
  if (!facts.date || !facts.course || !facts.raceNo) {
    return NextResponse.json({ error: "日付・場名・レース番号を入力してください。" }, { status: 400 });
  }

  const lengthKey = LENGTHS[body?.length] ? body.length : "standard";
  const target = LENGTHS[lengthKey];
  const editionLabel = facts.edition === "just_before" ? "直前版" : "前日版";
  const draft = body?.draft || {};

  const prompt = [
    "あなたはBoatStrikersの編集部で、一果新聞とnote記事を担当する日本語編集者です。",
    "以下の確認済み入力データだけを根拠に、読みやすい記事へ編集してください。",
    "",
    "【絶対ルール】",
    "- 入力にない数値・選手情報・モーター情報・展示情報・気象・進入・オッズ・結果を推測して追加しない",
    "- 数値、場名、レース番号、買い目は変更しない",
    "- 根拠のない断定をしない",
    "- AI v2 / shadow / model / raw / score など内部用語を本文に出さない",
    "- [object Object] を絶対に出さない",
    "- 舟券購入や利益を保証する表現を使わない",
    "- 一果は落ち着いて論理的、親しみやすい語り口にする",
    "- 同じ内容の言い換えを繰り返さない",
    "- Markdown見出しは ##、箇条書きは - を使用する",
    "",
    "【サイト記事の構成】",
    "## 一果の注目ポイント",
    "## データから見るこのレース",
    facts.edition === "just_before" ? "## 展示後に見たいポイント" : "## 直前版で確認したいこと",
    "## 一果のまとめ",
    "目安：" + target.site + "。短い段落を中心にする。",
    "",
    "【note記事の構成】",
    "導入文",
    "## 今日の一果新聞",
    "## 一果が注目したポイント",
    "## 数字から読み解くレース",
    facts.edition === "just_before" ? "## 展示後のチェックポイント" : "## 直前までに確認したいこと",
    "## 一果のまとめ",
    "最後にBoatStrikersサイトで出走表・直前版・過去新聞を確認できる旨を自然に案内する。",
    "目安：" + target.note + "。サイト記事より読み物として丁寧にする。",
    "",
    "【確認済み入力データ】",
    JSON.stringify({ ...facts, editionLabel }, null, 2),
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
  ].join("\\n");

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
