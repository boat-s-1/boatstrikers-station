import test from "node:test";
import assert from "node:assert/strict";

import { cleanSourceSummary, foldNameVariants } from "../../lib/newsArticle/sourceText.js";
import { extractNewsFacts } from "../../lib/newsArticle/newsFacts.js";
import { buildNewsArticleDraft } from "../../lib/newsArticle/draft.js";
import { checkNewsDraft, longestCommonSubstring } from "../../lib/newsArticle/qualityCheck.js";
import { loadNewsRaceData } from "../../lib/newsArticle/raceDataLoader.js";

const NIKKAN_TAIL = " - 日刊スポーツ新聞社のニュースサイト、ニッカンスポーツ・コム（nikkansports.com）";
const PROMO = "日刊スポーツで掲載された女子ボートレース関連ニュースです。初音NEWSでは元記事の内容を転載せず、確認できる事実をもとに注目ポイントを初音の視点で整理します。";

function entry(date, raceNo, boat, name, { cc = 10, reg = "04238", course = boat, st = 0.12, finish = "1", motor = 32, rate = 26.87 } = {}) {
  return { race_date: date, course_code: cc, race_no: raceNo, boat_no: boat, racer_registration_no: reg, racer_name: name, racer_class: "A1", motor_no: motor, motor_2_rate: rate, actual_course: course, actual_start_timing: st, arrival_order: finish };
}

function race(date, raceNo, { cc = 10, kind = "0008", closing = "16:20", technique = "逃げ", trifecta = "1-2-6", payout = 3400, popularity = 12 } = {}) {
  return { race_date: date, course_code: cc, race_no: raceNo, race_kind_code: kind, closing_time: closing, winning_technique: technique, trifecta, trifecta_payout: payout, trifecta_popularity: popularity };
}

const WIN_ROW = {
  id: 1,
  title: "【ボートレース】百戦錬磨の毒島誠が逃げ切りＶ 賞金ランクは９位に浮上／三国G1 [19:19]",
  summary: `12R優勝戦は毒島誠（42＝群馬）が逃げ切って優勝した。G1制覇は通算19度目。三国周年は5大会ぶり2度目、通算では89度目の優勝となった。展示が終わって不安…${NIKKAN_TAIL}`,
  category: "grade",
  source_type: "news",
  source_name: "日刊スポーツ",
  published_at: "2026-10-09T13:00:26Z",
};

const RACE_DATA = {
  entries: [
    entry("2026-10-08", 11, 1, "毒島　誠", { st: 0.1 }),
    entry("2026-10-09", 12, 1, "毒島　誠", { st: 0.03 }),
    entry("2026-10-09", 12, 2, "白井英治", { reg: "03897", finish: "2" }),
    entry("2026-10-10", 12, 1, "毒島　誠", { st: 0.2, finish: "6" }), // 記事公開後のレース（使わない）
  ],
  races: [race("2026-10-08", 11), race("2026-10-09", 12, { kind: "0021" }), race("2026-10-10", 12)],
  grades: [],
  digests: [],
};

test("要約から出典サイトの後置き・途中で切れた文・収集時の定型文・URLを除く", () => {
  const cleaned = cleanSourceSummary(`1文目です。2文目は途中で…${NIKKAN_TAIL}`);
  assert.deepEqual(cleaned.sentences, ["1文目です。"]);
  assert.ok(cleaned.removed.includes("site_tail") && cleaned.removed.includes("truncated"));
  assert.deepEqual(cleanSourceSummary(PROMO).sentences, []);
  assert.deepEqual(cleanSourceSummary("詳細は https://example.com/a で確認。結果が出た。").sentences, ["詳細は で確認。", "結果が出た。"]);
  assert.ok(!cleanSourceSummary("詳細は https://example.com/a で確認。").sentences.join("").includes("http"));
  assert.deepEqual(cleanSourceSummary("「まくることは頭になくて、とっさに体が反応して…").sentences, []);
});

test("NEWS FACT：見出し・要約の事実を BoatStrikers の文で組み立て、目標の表現は記録にしない", () => {
  const draft = buildNewsArticleDraft(WIN_ROW, RACE_DATA);
  assert.equal(draft.newsFact.lead, "三国G1の12R優勝戦で、毒島誠（42歳・群馬支部）が逃げ切って優勝した。");
  const values = draft.newsFact.points.map((p) => p.value);
  assert.ok(values.includes("G1優勝は通算19度目"));
  assert.ok(values.includes("通算89度目の優勝"));
  assert.ok(!draft.text.includes("日刊スポーツ") && !draft.text.includes("…"));

  const preview = extractNewsFacts({ title: "【ボートレース】優勝戦１枠は白神優 通算17度目Ｖへ持ち前のスタート力を発揮する／戸田", summary: "通算17度目の優勝を目指す。", published_at: "2026-10-11T13:00:00Z" });
  assert.deepEqual(preview.counts, []);
});

test("NEWS FACT：他の選手の枠・コース・STを主役の事実に混ぜない", () => {
  const facts = extractNewsFacts(
    {
      title: "【ボートレース】絶好枠の守田俊介がイン逃げを決めて今年３度目の優勝／若松ミッド",
      summary: "若松ミッド11Rの優勝戦で、1枠の守田俊介がイン逃げを決め、今年3度目の優勝を飾った。3コースの大神康司はコンマ01のフライングとなった。",
      published_at: "2026-10-10T01:00:00Z",
    },
    { knownNames: ["守田俊介", "大神康司"] },
  );
  assert.equal(facts.racer.name, "守田俊介");
  assert.equal(facts.frame, 1);
  assert.equal(facts.course, 1);
  assert.equal(facts.st, null);
  assert.equal(facts.flying, false);
});

test("NEWS FACT：2着・条件付きの着順・並記されたレースを1着として扱わない", () => {
  const second = extractNewsFacts({ title: "【ボートレース】藤原菜希は悔しいイン戦２着も準優２枠確保／江戸川", summary: "江戸川で藤原菜希が4日目7Rのイン戦で2着に敗れたが、準優11Rの2枠を確保した。安井瑞紀のまくりを許す結果となった。", published_at: "2026-10-10T13:00:00Z" }, { knownNames: ["藤原菜希", "安井瑞紀"] });
  assert.equal(second.raceNo, 7);
  assert.equal(second.result, "2着");
  assert.equal(second.style, "");
  const conditional = extractNewsFacts({ title: "【ボートレース】白井英治は減点でも予選ラスト12R４着以上で届く計算／三国G1", summary: "", published_at: "2026-10-08T13:00:00Z" }, { knownNames: ["白井英治"] });
  assert.equal(conditional.result, "");
  const listed = extractNewsFacts({ title: "【ボートレース】今垣光太郎が仕上げに苦悩", summary: "三国G1で今垣光太郎が5、9Rを5着、4着とし、調整に課題を残した。", published_at: "2026-10-05T13:00:00Z" }, { knownNames: ["今垣光太郎"] });
  assert.equal(listed.result, "");
  const goal = extractNewsFacts({ title: "エース級エンジンを駆る増本杏珠が芦屋初勝利を目指す/芦屋・GⅢオールレディース マクール杯", summary: "", published_at: "2026-09-24T08:57:00Z" });
  assert.equal(goal.result, "");
});

test("DATA CHECK：選手名・開催場・日付で一意に照合し、公開後のレースは使わない", () => {
  const draft = buildNewsArticleDraft(WIN_ROW, RACE_DATA);
  assert.equal(draft.dataCheck.kind, "racer");
  assert.equal(draft.dataCheck.series.length, 2);
  assert.ok(draft.dataCheck.rows.some((r) => r.label === "10/9 12R" && r.value.includes("ST.03")));
  assert.ok(!draft.text.includes("6着"));
  const results = Object.fromEntries(draft.dataCheck.checks.map((c) => [c.item, c.result]));
  assert.equal(results["優勝戦"], "一致");
  assert.equal(results["決まり手"], "一致");
  assert.equal(results["グレード"], "未確認");
  assert.equal(draft.status, "ready");
});

test("DATA CHECK：同名選手が複数いる・出走表にいない場合は欄ごと省略する", () => {
  const twins = { ...RACE_DATA, entries: [...RACE_DATA.entries, entry("2026-10-09", 3, 4, "毒島誠", { reg: "09999" })] };
  const ambiguous = buildNewsArticleDraft(WIN_ROW, twins);
  assert.equal(ambiguous.dataCheck, null);
  assert.match(ambiguous.dataCheckSkipped, /複数/);
  const missing = buildNewsArticleDraft({ ...WIN_ROW, title: WIN_ROW.title.replace("毒島誠", "山田太郎"), summary: "" }, RACE_DATA);
  assert.equal(missing.dataCheck, null);
});

test("DATA CHECK：レース種別で確認できない優勝戦は「未確認」にし、DATA CHECK に優勝戦と書かない", () => {
  const data = { ...RACE_DATA, races: RACE_DATA.races.map((r) => ({ ...r, race_kind_code: "0008" })) };
  const draft = buildNewsArticleDraft(WIN_ROW, data);
  const final = draft.dataCheck.checks.find((c) => c.item === "優勝戦");
  assert.equal(final.result, "未確認");
  assert.ok(!draft.dataCheck.rows.some((r) => /優勝戦|G1/.test(`${r.label}${r.value}`)));
});

test("DATA CHECK：記事と DB の不一致は自動で直さず needs_review にする", () => {
  const data = { ...RACE_DATA, races: RACE_DATA.races.map((r) => (r.race_no === 12 ? { ...r, winning_technique: "まくり" } : r)) };
  const draft = buildNewsArticleDraft(WIN_ROW, data);
  assert.equal(draft.dataCheck.checks.find((c) => c.item === "決まり手").result, "不一致");
  assert.equal(draft.status, "needs_review");
});

test("DATA CHECK：選手名の異体字（大滝/大瀧）は同一視して照合する", () => {
  assert.equal(foldNameVariants("大瀧　明日香"), foldNameVariants("大滝明日香"));
  const row = { id: 2, title: "【ボートレース】大滝明日香が好調機味方に白星「競ってみてどうか」／下関ミッド", summary: "", source_type: "news", published_at: "2026-10-11T14:09:09Z" };
  const data = { entries: [entry("2026-10-11", 6, 2, "大瀧明日香", { cc: 19, reg: "03999" })], races: [race("2026-10-11", 6, { cc: 19, closing: "19:56" })] };
  const draft = buildNewsArticleDraft(row, data);
  assert.equal(draft.dataCheck.kind, "racer");
  assert.match(draft.dataCheck.checks[0].db, /大瀧明日香/);
});

test("BS DATA：公開時点で締切前のレースの「結果確定」記事は本文を作らない", () => {
  const row = { id: 3, title: "徳山9R 9Rの結果を更新", summary: "2026年10月12日の徳山9Rで、女子戦のレース結果が確定しました。", source_type: "bs_data", place: "徳山", published_at: "2026-10-12T01:00:11Z" };
  const data = { entries: [entry("2026-10-12", 9, 5, "上田紗奈", { cc: 18, reg: "05057" })], races: [race("2026-10-12", 9, { cc: 18, closing: "12:46", technique: "まくり", trifecta: "5-1-4", payout: 4160 })] };
  const draft = buildNewsArticleDraft(row, data);
  assert.equal(draft.status, "insufficient");
  assert.equal(draft.text, "");
  assert.match(draft.dataCheckSkipped, /締切前/);
});

test("BS DATA：女子戦の高モーター記事は、性別データが無いため女子内の順位を「未確認」にする", () => {
  const row = { id: 4, title: "びわこ女子戦の高モーターは小 野 生 奈の20号機・2連対率38.1%", summary: "", source_type: "bs_data", category: "motor", place: "びわこ", published_at: "2026-10-12T01:00:11Z" };
  const data = {
    entries: [
      entry("2026-10-12", 6, 1, "小野　生奈", { cc: 11, reg: "04530", motor: 20, rate: 38.1 }),
      entry("2026-10-12", 6, 2, "別の選手", { cc: 11, reg: "01111", motor: 33, rate: 45.2 }),
    ],
    races: [],
  };
  const draft = buildNewsArticleDraft(row, data);
  assert.equal(draft.dataCheck.checks.find((c) => c.item === "順位").result, "未確認");
  assert.match(draft.newsFact.lead, /^びわこの女子戦で/);
});

test("EDITOR'S VIEW：材料があるときだけ、担当分野に合うキャラクターが事実だけでコメントする", () => {
  // 女子記事でなく万舟でもない → 一果（1コースの数字）が担当する。
  const ichika = buildNewsArticleDraft(WIN_ROW, RACE_DATA).editorView;
  assert.equal(ichika.character, "ichika");
  assert.match(ichika.text, /^12Rは1コースからST\.03で1着。今節の1コースは2走2勝です。/);
  const upset = { ...RACE_DATA, races: RACE_DATA.races.map((r) => (r.race_no === 12 ? { ...r, trifecta_payout: 18360, trifecta_popularity: 54 } : r)) };
  const view = buildNewsArticleDraft(WIN_ROW, upset).editorView;
  assert.equal(view.character, "kiina");
  assert.match(view.text, /18,360円/);
  assert.doesNotMatch(view.text, /期待|だろう|狙い目/);
  const noData = buildNewsArticleDraft(WIN_ROW, { entries: [], races: [] });
  assert.equal(noData.editorView, null);
});

test("品質チェック：出典名・定型文・女子テンプレート・丸写し・根拠のない数値・予想を検出する", () => {
  const row = { title: "【ボートレース】四宮与寛が逃げ切って今年２度目Ｖ／戸田", summary: "四宮与寛が1枠から逃げ切り今年2度目の優勝を飾った。", category: "win", source_type: "news" };
  const draft = (lead) => ({ newsFact: { lead, points: [] }, dataCheck: null, editorView: null });
  const codes = (lead) => checkNewsDraft(draft(lead), row).issues.map((i) => i.code);
  assert.ok(codes("日刊スポーツによると優勝した。").includes("source_name"));
  assert.ok(codes("女子戦をチェックするうえで見逃せない材料です。").includes("promo"));
  assert.ok(codes("戸田で優勝した。女子戦の流れも押さえたい。").includes("women_leak"));
  assert.ok(codes("四宮与寛が1枠から逃げ切り今年2度目の優勝を飾った。").includes("copy"));
  assert.ok(codes("戸田で四宮与寛が通算30度目の優勝。").includes("unsupported_number"));
  assert.ok(codes("次節も優勝が期待される。").includes("speculation"));
  assert.deepEqual(codes("戸田で、四宮与寛が逃げ切って優勝した。"), []);
  assert.deepEqual(codes("談話は「勝てるかもしれない」。"), []); // 「」内の談話は予想表現の対象外
  assert.equal(longestCommonSubstring("abcdef", "zzcdefzz").length, 4);
});

test("レースデータの取得は読み取り（select）だけを使う", async () => {
  const calls = [];
  const chain = (table) => {
    const q = {};
    for (const method of ["select", "eq", "gte", "lte", "limit", "in", "order"]) {
      q[method] = (...args) => {
        calls.push(`${table}.${method}`);
        return q;
      };
    }
    q.then = (resolve) => resolve({ data: [], error: null });
    return q;
  };
  const fake = { from: (table) => chain(table) };
  for (const forbidden of ["insert", "update", "upsert", "delete", "rpc"]) fake[forbidden] = () => assert.fail(`${forbidden} が呼ばれた`);
  const data = await loadNewsRaceData(fake, { courseCode: 10, from: "2026-10-03", to: "2026-10-09", digestDate: "2026-10-09" });
  assert.deepEqual(Object.keys(data), ["entries", "races", "grades", "digests"]);
  assert.ok(calls.every((c) => /\.(select|eq|gte|lte|limit|in|order)$/.test(c)));
  assert.ok(calls.some((c) => c.startsWith("bs_race_entries.select")));
});
