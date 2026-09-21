import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../admin/sync/_lib/adminAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

const LENGTHS = {
  short: { site: "600〜900字", note: "1,050〜1,600字", tokens: 3200 },
  standard: { site: "850〜1,300字", note: "1,550〜2,450字", tokens: 4500 },
  detailed: { site: "1,200〜1,900字", note: "2,150〜3,500字", tokens: 6200 },
};

function plain(value) {
  if (value === null || value === undefined || typeof value === "object") return "";
  return String(value).trim();
}

function numeric(value) {
  const raw = plain(value);
  return raw && /^-?\d+(?:\.\d+)?$/.test(raw) ? raw : "";
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
    headline: plain(source.headline || raw.mainCopy),
    escapeRate: numeric(raw.escapeRate),
    nationalAverage: numeric(raw.nationalAverage),
    honmeiBoat: numeric(raw.honmeiBoat),
    honmeiTitle: plain(raw.honmeiTitle),
    honmeiComment: plain(raw.honmeiComment),
    ichikaComment: plain(raw.ichikaComment),
    speech: plain(raw.speech),
    // 展示情報は直前版だけAIへ渡す。前日版では値が管理画面に残っていても物理的に除外する。
    ...(isJustBefore ? {
      exhibition1: plain(raw.exhibition1),
      exhibition2: plain(raw.exhibition2),
      exhibition3: plain(raw.exhibition3),
    } : {}),
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
  return parts.join("\n").trim();
}

function parseObject(value) {
  const cleaned = String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
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
    "あなたはBoatStrikersの一果本人として、読者に語りかける一人称の記事を書きます。",
    "以下の確認済み入力データだけを根拠に、一果が自分の目線でレースを解説する読みやすい記事へ編集してください。",
    "",
    "【絶対ルール】",
    "- 入力にない数値・選手情報・モーター情報・展示情報・気象・進入・オッズ・結果を推測して追加しない",
    "- 数値、場名、レース番号、買い目は変更しない",
    "- 根拠のない断定をしない",
    "- ユーザー入力のコメントや見立てを、一般的・客観的に確立した事実のように格上げして言い換えない",
    "- 入力コメントを使うときは『私はこう見ています』『私が注目したいのは』『今回はこう考えています』など、一果本人の一人称で自然に表現する",
    "- 前日版では展示気配・展示タイム・スタート展示・進入の確定情報を本文に書かない。展示・進入は『直前版で確認したいこと』として未来形でのみ触れる",
    "- 直前版では展示情報をすでに確認済みの前提で書く。『これから展示を見る』『スタート展示で見極める』『展示後も変わらないか確認する』など、展示前に戻る表現は禁止",
    "- 直前版では、入力された展示評価を現在完了の材料として使い、『展示を見て〜と評価しています』『展示では〜がポイントでした』のように表現する",
    "- 直前版で進入情報が入力されていない場合は、進入を確定情報として書かず、『進入に変化がないか確認する』程度にとどめる",
    "- AI v2 / shadow / model / raw / score など内部用語を本文に出さない",
    "- [object Object] を絶対に出さない",
    "- 舟券購入や利益を保証する表現を使わない",
    "- 一果は落ち着いて論理的、親しみやすい『先生・解説役』の語り口にする",
    "- 記事本文は一果本人の一人称を中心にする。『私がまず見たいのは』『私はここを確認したいです』『私はこう考えています』を自然に使う",
    "- 一人称は各セクションで1〜2回程度を目安にし、毎段落『私』から始めない",
    "- 『私が』『私は』を連続する段落で繰り返さず、必要なところだけに使う",
    "- 『今回の見立ては』『入力された評価』『内容になります』『〜とされています』『〜とされており』のような編集部・AI・第三者目線の言い回しは避ける",
    "- headline / input / source / sourcePayload / prompt / model など、実装・内部データを連想させる語を本文に絶対に出さない",
    "- 『現時点』『前日段階』『前日版では』『直前情報では』など、時点を示す言葉を必要以上に繰り返さない",
    "- 注意書きや保留表現を各セクションで何度も入れず、必要な場所に一度だけ置く",
    "- 一果は慎重だが迷いすぎない。判断を保留し続ける文章ではなく、今の評価を明確に示してから直前確認へつなげる",
    "- 同じ内容の言い換えを繰り返さない",
    "- 文章は現在の生成品質を保ちながら、重複表現を削って全体を10〜15%程度引き締める",
    "- 1つの主張は原則1回だけ明確に書き、別セクションで同じ結論を言い換えて再掲しない",
    "- 『数字だけで決まらない』『最終判断は直前で』など同種の注意表現は記事全体で1回程度にまとめる",
    "- 同じ数値や結論を複数セクションで何度も反復しない。数値の詳説は主に『データから見るこのレース』へ集約する",
    "- 『一果の注目ポイント』では結論と着眼点を2〜3段落で簡潔に示し、『データから見るこのレース』で数字を詳しく説明する。両方で同じ説明を繰り返さない",
    "- 『データから見るこのレース』で数値を説明したら、その数値の意味を別の段落でもう一度説明しない",
    "- 前日版で相手を決められない場合は『展示や進入などの直前情報を確認して整理したい』程度にとどめ、『直前の出走表』とは書かない",
    "- 進入については『進入に変化がないか確認する』など簡潔に書き、『1号艇がどの位置からレースを始めるか』のような回りくどい表現を避ける",
    "- 『一果のまとめ』は本文の再説明ではなく、一果が読者へ最後に伝える2〜3文程度の短いコメントとして締める",
    "- 前日版と直前版は、最初の見出しと導入文だけで版の違いが分かるようにする",
    "- 前日版の導入は『前日版の一果チェックです』など、予想の土台を整理する記事だと自然に伝える",
    "- 直前版の導入は『展示後の直前版です』など、展示確認後の最終チェック記事だと自然に伝える",
    "- 導入の版説明は1回だけにし、以降は『前日版』『直前版』を必要以上に繰り返さない",
    "- Markdown見出しは ##、箇条書きは - を使用する",
    "",
    "【サイト記事の構成】",
    facts.edition === "just_before" ? "## 直前版｜展示後の一果チェック" : "## 前日版｜一果の注目ポイント",
    facts.edition === "just_before" ? "## 展示データから見るこのレース" : "## 前日データから見るこのレース",
    facts.edition === "just_before" ? "## 相手関係の最終チェック" : "## 直前版で確認したいこと",
    facts.edition === "just_before" ? "## 一果の直前まとめ" : "## 一果の前日まとめ",
    "目安：" + target.site + "。短い段落を中心にし、一果が読者へ話しかける自然な文章にする。安全性のための説明を長くしすぎず、読み物としてテンポよく進める。" +
      (facts.edition === "just_before"
        ? " 直前版では、展示前→展示後へ時間を巻き戻さず、確認済みの展示評価から最終チェックへ進む。"
        : " 前日版では、未確認の展示・進入を未来形で扱い、直前版で何を確認するかへつなげる。"),
    "",
    "【note記事の構成】",
    facts.edition === "just_before"
      ? "導入文：『展示後の直前版です』という意味が自然に伝わる1〜2文で始める"
      : "導入文：『前日版の一果チェックです』という意味が自然に伝わる1〜2文で始める",
    facts.edition === "just_before" ? "## 今日の一果新聞｜直前版" : "## 今日の一果新聞｜前日版",
    facts.edition === "just_before" ? "## 展示後に一果が見たポイント" : "## 前日版で一果が見たポイント",
    facts.edition === "just_before" ? "## 展示データから読み解くレース" : "## 前日データから読み解くレース",
    facts.edition === "just_before" ? "## 最後に確認したいこと" : "## 直前までに確認したいこと",
    facts.edition === "just_before" ? "## 一果の直前まとめ" : "## 一果の前日まとめ",
    "最後にBoatStrikersサイトで出走表・直前版・過去新聞を確認できる旨を自然に案内する。",
    "目安：" + target.note + "。サイト記事より読み物として丁寧にし、一果本人の解説記事として仕上げる。同じ数値や注意点の再説明は避ける。" +
      (facts.edition === "just_before"
        ? " 直前版は展示確認済みの記事として時系列を統一する。"
        : " 前日版は展示前の記事として時系列を統一する。"),
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
