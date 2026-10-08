// 一果・初音・キイナの前日版新聞（レース当日の展示前予想）を自動で下書き保存する。
//
// 安全上の約束
// - 公開しない（常に draft）。既存の新聞は上書きしない（insertNewspaperDraftIfAbsent）。
// - データが足りないレースは作らない。手動画面の初期値（ダミーの数値）は使わない。
// - 使うのは ai_v2_daily_rankings（data_timing=previous_day）・凍結済み公式買い目・出走表・レース結果・締切時刻だけ。
//   前夜取得の公式出走表（別系統）は参照しない。展示データの列も読まない。
// - AIの出力は factGuard で「項目と数値の対応」を照合し、照合できなければ保存しない。
import { STADIUMS, buildRaceInsights, HATSUNE_FALLBACK_CHECKPOINTS, loadFrozenPrediction, validDate } from "./predictionSources.mjs";
import { buildNewspaperChannels, newspaperChannelInput } from "./channels.mjs";
import { insertNewspaperDraftIfAbsent, NEWSPAPER_TABLE } from "./publicationStore.mjs";
import { buildFactSheet, parseCheckpointFact, verifyNewspaperFields } from "./factGuard.mjs";

export const AUTO_DRAFT_GENERATOR = "auto-previous-day-v1";
export const AUTO_DRAFT_LOG_TYPE = "newspaper_auto_draft";
export const AUTO_DRAFT_LIMITS = { ichika: 1, hatsune: 1, kiina: 1 };
export const AUTO_DRAFT_CHARACTERS = ["ichika", "hatsune", "kiina"];
export const DATA_TIMING = "previous_day";
export const EDITION = "previous_day";
export const CLOSING_MARGIN_MINUTES = 20;
export const MAX_FAILURES_PER_RACE = 2;
export const AI_LENGTH = "standard";

const RANKING_TYPES = {
  ichika: ["ichika_escape_best10"],
  hatsune: ["hatsune_dominant_best3", "hatsune_risky_best3"],
  kiina: ["kiina_boat5_best5"],
};

export function jstDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * 実行モードを決める。
 * - blocked : 本番環境（VERCEL_ENV=production）では、明示的な許可フラグが無い限り何もしない。
 * - dry_run : DB読み取りのみ。AI呼び出し・DB書き込み・ログ記録をしない。
 * - disabled: NEWSPAPER_AUTO_DRAFT_ENABLED=true でなければ、読み取りも含めて何もしない。
 * - write   : 当日分の下書きを作る。
 */
export function resolveRunMode({ env = {}, searchParams, now = new Date() }) {
  const today = jstDate(now);
  if (env.VERCEL_ENV === "production" && env.NEWSPAPER_AUTO_DRAFT_ALLOW_PRODUCTION !== "true") {
    return { mode: "blocked", reason: "production_blocked", date: today };
  }
  const dryRun = ["1", "true"].includes(String(searchParams?.get("dry_run") || "").toLowerCase());
  if (dryRun) {
    const requested = searchParams.get("date");
    if (requested && !validDate(requested)) return { mode: "blocked", reason: "invalid_date", date: today };
    return { mode: "dry_run", date: requested || today };
  }
  if (env.NEWSPAPER_AUTO_DRAFT_ENABLED !== "true") return { mode: "disabled", reason: "auto_draft_disabled", date: today };
  return { mode: "write", date: today };
}

// ---- 締切時刻（generate-predictions と同じ解釈） ----

function normalizeClosingTime(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
    const [hour, minute, second = "00"] = text.split(":");
    return { hour: Number(hour), minute: Number(minute), second: Number(second) };
  }
  if (/^\d{3,4}$/.test(text)) {
    const padded = text.padStart(4, "0");
    return { hour: Number(padded.slice(0, 2)), minute: Number(padded.slice(2, 4)), second: 0 };
  }
  return null;
}

export function closingAt(raceDate, closingTime) {
  if (closingTime === null || closingTime === undefined || closingTime === "") return null;
  const text = String(closingTime).trim();
  if (text.includes("T")) {
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const time = normalizeClosingTime(text);
  if (!time) return null;
  const date = new Date(`${raceDate}T${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}:${String(time.second).padStart(2, "0")}+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ---- データ取得 ----

async function must(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}の取得に失敗しました: ${error.message}`);
  return data || [];
}

async function loadDayContext(supabase, date) {
  const [newspapers, events, results, logs] = await Promise.all([
    must(supabase.from(NEWSPAPER_TABLE).select("id,course_name,race_no,character_key,edition,status,source_payload").eq("race_date", date).eq("edition", EDITION), "既存の新聞"),
    must(supabase.from("bs_race_events").select("course_code,race_no,closing_time").eq("race_date", date), "レース情報"),
    must(supabase.from("bs_race_results").select("course_code,race_no").eq("race_date", date), "レース結果"),
    must(supabase.from("bs_news_sync_logs").select("run_at,details").eq("run_type", AUTO_DRAFT_LOG_TYPE).gte("run_at", `${date}T00:00:00+09:00`).order("run_at", { ascending: false }).limit(200), "実行ログ"),
  ]);
  const failures = new Map();
  for (const log of logs) {
    if (log?.details?.date !== date) continue;
    for (const result of log.details.results || []) {
      if (["ai_failed", "fact_guard_rejected", "save_failed"].includes(result.outcome)) {
        const key = `${result.character}:${result.courseCode}:${result.raceNo}`;
        failures.set(key, (failures.get(key) || 0) + 1);
      }
    }
  }
  return {
    newspapers,
    events: new Map(events.map((event) => [`${Number(event.course_code)}:${Number(event.race_no)}`, event])),
    results: new Set(results.map((row) => `${Number(row.course_code)}:${Number(row.race_no)}`)),
    failures,
  };
}

async function loadRankings(supabase, character, date) {
  return must(supabase.from("ai_v2_daily_rankings")
    .select("id,ranking_type,rank_no,course_code,race_no,probability,social_comment,model_version,updated_at")
    .eq("ranking_date", date).eq("character_code", character).eq("data_timing", DATA_TIMING)
    .in("ranking_type", RANKING_TYPES[character])
    .order("ranking_type", { ascending: true }).order("rank_no", { ascending: true }), "AIランキング");
}

// 展示データの列は読まない（前日版では使わないため）。
async function loadEntries(supabase, date, courseCode, raceNo) {
  return must(supabase.from("bs_race_entries")
    .select("boat_no,national_win_rate,local_win_rate,average_st,motor_top2_rate,race_boat_top2_rate")
    .eq("race_date", date).eq("course_code", courseCode).eq("race_no", raceNo)
    .order("boat_no", { ascending: true }), "出走表");
}

// ---- 候補の確認 ----

function percentText(probability) {
  return (Number(probability) * 100).toFixed(1);
}

export function rankingProblem(ranking) {
  const probability = ranking.probability;
  if (probability === null || probability === undefined || probability === "" || !Number.isFinite(Number(probability))) return "invalid_probability";
  if (Number(probability) < 0 || Number(probability) > 1) return "invalid_probability";
  const courseCode = Number(ranking.course_code);
  const raceNo = Number(ranking.race_no);
  if (!Number.isInteger(courseCode) || courseCode < 1 || courseCode > 24) return "invalid_course";
  if (!Number.isInteger(raceNo) || raceNo < 1 || raceNo > 12) return "invalid_race_no";
  if (!Number.isInteger(Number(ranking.rank_no)) || Number(ranking.rank_no) < 1) return "invalid_rank";
  return null;
}

export function entriesComplete(entries) {
  const boats = entries.map((entry) => Number(entry.boat_no)).sort((a, b) => a - b);
  return boats.length === 6 && boats.every((boat, index) => boat === index + 1);
}

function raceTimingProblem(context, date, courseCode, raceNo, now) {
  const key = `${courseCode}:${raceNo}`;
  if (context.results.has(key)) return "race_finished";
  const event = context.events.get(key);
  if (!event) return "race_event_missing";
  const closing = closingAt(date, event.closing_time);
  if (!closing) return "closing_time_unknown";
  if (now.getTime() >= closing.getTime() - CLOSING_MARGIN_MINUTES * 60 * 1000) return "race_closed";
  return null;
}

// ---- 記事の材料（ダミー値は使わない） ----

function frozenTickets(prediction) {
  if (!prediction || !Array.isArray(prediction.tickets)) return { tickets: [], unitStake: null, investment: null };
  const tickets = prediction.tickets.filter((ticket) => typeof ticket === "string" && /^[1-6]-[1-6]-[1-6]$/.test(ticket.trim())).map((ticket) => ticket.trim());
  if (!tickets.length || tickets.length !== prediction.tickets.length) return { tickets: [], unitStake: null, investment: null };
  const unitStake = Number(prediction.unit_stake);
  const investment = Number(prediction.investment);
  return {
    tickets,
    unitStake: Number.isFinite(unitStake) && unitStake > 0 ? unitStake : null,
    investment: Number.isFinite(investment) && investment > 0 ? investment : null,
  };
}

function ticketFields(frozen) {
  if (!frozen.tickets.length) return {};
  return {
    aiTickets: frozen.tickets,
    ...(frozen.unitStake !== null ? { aiUnitStake: frozen.unitStake } : {}),
    ...(frozen.investment !== null ? { aiInvestment: frozen.investment } : {}),
  };
}

function ticketFacts(frozen) {
  const facts = [];
  if (frozen.unitStake !== null) facts.push({ labels: ["1点", "1口", "単価", "点あたり"], value: frozen.unitStake, unit: "円" });
  if (frozen.investment !== null) facts.push({ labels: ["投資", "合計", "総額", "購入額"], value: frozen.investment, unit: "円" });
  return facts;
}

/**
 * 1レース分の材料を作る。足りなければ { problem } を返す。
 * 見出し等の固定文は手動画面の候補文のうち数値を含まないものを使う。
 */
export function buildDraftMaterial({ character, date, ranking, entries, frozenPrediction }) {
  const courseCode = Number(ranking.course_code);
  const raceNo = Number(ranking.race_no);
  const course = STADIUMS[courseCode - 1];
  const rate = percentText(ranking.probability);
  const comment = typeof ranking.social_comment === "string" ? ranking.social_comment.trim() : "";
  const frozen = frozenTickets(frozenPrediction);
  const common = { date, course, raceNo: String(raceNo), edition: EDITION };
  let value;
  let facts;

  if (character === "ichika") {
    value = { ...common, mainCopy: `${course}${raceNo}R、1号艇中心に相手比較！`, escapeRate: rate, honmeiBoat: "1", ichikaComment: comment, ...ticketFields(frozen) };
    facts = [{ labels: ["イン逃げ率", "イン逃げ期待", "逃げ率", "逃げ期待", "イン逃げ", "期待度"], value: rate, unit: "%" }];
  } else if (character === "hatsune") {
    const category = ranking.ranking_type === "hatsune_dominant_best3" ? "イン逃げが圧倒的" : "インが不安";
    const insights = buildRaceInsights(entries, category, DATA_TIMING);
    if (insights.checkpoints.some((point) => HATSUNE_FALLBACK_CHECKPOINTS.includes(point))) return { problem: "insights_fallback" };
    const boatFacts = insights.checkpoints.map(parseCheckpointFact);
    if (boatFacts.some((fact) => !fact)) return { problem: "insights_unverifiable" };
    value = { ...common, headline: `${course}${raceNo}R 女子戦をチェック♪`, expectation: rate, featuredBoat: insights.featuredBoat, checkpoints: insights.checkpoints, aiCategory: category, comment, ...ticketFields(frozen) };
    facts = [{ labels: ["女子戦期待度", "期待度"], value: rate, unit: "%" }, ...boatFacts];
  } else if (character === "kiina") {
    value = { ...common, headline: `${course}${raceNo}R 穴候補をチェック！`, holeBoat: "5", holeChance: rate, callout: "5号艇に注目！", kiinaComment: comment, ...ticketFields(frozen) };
    facts = [{ labels: ["穴狙い期待度", "穴期待", "穴狙い", "期待度", "1着確率", "1着"], value: rate, unit: "%", boat: null }];
  } else {
    return { problem: "unknown_character" };
  }

  const channelInput = newspaperChannelInput(character, value);
  const template = buildNewspaperChannels(channelInput);
  const sheet = buildFactSheet({ date, raceNo, rankNo: ranking.rank_no, facts: [...facts, ...ticketFacts(frozen)], tickets: frozen.tickets });
  const aiBody = {
    character,
    source: channelInput,
    sourcePayload: value,
    draft: { title: template.title, summary: template.summary, articleBody: template.articleBody, noteTitle: template.noteTitle, noteBody: template.noteBody },
    length: AI_LENGTH,
  };
  return { course, courseCode, raceNo, value, template, sheet, aiBody, frozen };
}

// ---- 本体 ----

/**
 * runAutoDraft({ supabase, mode, date, now, aiWrite, timeBudgetMs, startedAt, clock })
 * aiWrite(body) → { status, body }（runNewspaperAiWrite と同じ形）。dry_run では呼ばない。
 */
export async function runAutoDraft({ supabase, mode, date, now = new Date(), aiWrite, timeBudgetMs = 50_000, clock = () => Date.now(), startedAt = clock(), model = null }) {
  if (!["dry_run", "write"].includes(mode)) throw new Error(`runAutoDraft は ${mode} では実行できません`);
  if (!validDate(date)) throw new Error("日付が不正です");
  if (mode === "write" && date !== jstDate(now)) throw new Error("書き込みは当日分のみです");
  const writable = mode === "write";

  const context = await loadDayContext(supabase, date);
  const results = [];
  let stopForTime = false;

  for (const character of AUTO_DRAFT_CHARACTERS) {
    const record = { character, outcome: null, skipped: [] };
    results.push(record);
    const autoCount = context.newspapers.filter((row) => row.character_key === character && row.source_payload?.generator === AUTO_DRAFT_GENERATOR).length;
    if (autoCount >= AUTO_DRAFT_LIMITS[character]) { record.outcome = "limit_reached"; continue; }
    if (stopForTime) { record.outcome = "deferred_time_budget"; continue; }

    const rankings = await loadRankings(supabase, character, date);
    if (!rankings.length) { record.outcome = "no_candidates"; continue; }

    for (const ranking of rankings) {
      const where = { courseCode: Number(ranking.course_code), raceNo: Number(ranking.race_no), rankingType: ranking.ranking_type, rankNo: Number(ranking.rank_no) };
      const skip = (reason) => record.skipped.push({ ...where, reason });

      const invalid = rankingProblem(ranking);
      if (invalid) { skip(invalid); continue; }
      const courseName = STADIUMS[where.courseCode - 1];
      if (context.newspapers.some((row) => row.character_key === character && row.course_name === courseName && Number(row.race_no) === where.raceNo)) { skip("exists"); continue; }
      const timing = raceTimingProblem(context, date, where.courseCode, where.raceNo, now);
      if (timing) { skip(timing); continue; }
      if ((context.failures.get(`${character}:${where.courseCode}:${where.raceNo}`) || 0) >= MAX_FAILURES_PER_RACE) { skip("retry_limit"); continue; }

      const entries = await loadEntries(supabase, date, where.courseCode, where.raceNo);
      if (!entriesComplete(entries)) { skip("entries_incomplete"); continue; }

      const { data: frozenPrediction, error: frozenError } = await loadFrozenPrediction(supabase, {
        date, courseCode: where.courseCode, raceNo: where.raceNo, character, timing: DATA_TIMING, rankingType: ranking.ranking_type, rankNo: ranking.rank_no,
      });
      if (frozenError) throw new Error(`公式買い目の取得に失敗しました: ${frozenError.message}`);

      const material = buildDraftMaterial({ character, date, ranking, entries, frozenPrediction });
      if (material.problem) { skip(material.problem); continue; }

      Object.assign(record, where, { course: material.course, hasFrozenTickets: material.frozen.tickets.length > 0 });
      if (!writable) {
        record.outcome = "would_generate";
        record.facts = material.value;
        break;
      }
      if (clock() - startedAt > timeBudgetMs) {
        record.outcome = "deferred_time_budget";
        stopForTime = true;
        break;
      }

      // ここから先で失敗しても次の候補へは進まない（同時実行時に別レースを選ばないため）。
      let ai;
      try {
        ai = await aiWrite(material.aiBody);
      } catch (error) {
        ai = { status: 0, body: { error: error?.message || String(error) } };
      }
      if (ai.status !== 200 || !ai.body?.ok) {
        record.outcome = "ai_failed";
        record.reason = String(ai.body?.error || `status ${ai.status}`).slice(0, 300);
        break;
      }

      const article = ai.body.result;
      const publication = {
        title: material.template.title,
        summary: article.summary,
        articleBody: article.articleBody,
        noteTitle: article.noteTitle,
        noteBody: article.noteBody,
        xPost: material.template.xPost,
        shortsScript: material.template.shortsScript,
      };
      const guard = verifyNewspaperFields(publication, material.sheet);
      if (!guard.ok) {
        record.outcome = "fact_guard_rejected";
        record.violations = guard.violations.slice(0, 10);
        break;
      }

      try {
        const saved = await insertNewspaperDraftIfAbsent(supabase, {
          date, course: material.course, raceNo: material.raceNo, character, edition: EDITION, ...publication,
          sourcePayload: {
            generator: AUTO_DRAFT_GENERATOR,
            generated_at: new Date(clock()).toISOString(),
            basis: "race_day_pre_exhibition",
            data_timing: DATA_TIMING,
            ranking: { id: ranking.id ?? null, ranking_type: ranking.ranking_type, rank_no: ranking.rank_no, probability: ranking.probability, model_version: ranking.model_version ?? null, updated_at: ranking.updated_at ?? null },
            official_prediction: frozenPrediction ? { source_table: frozenPrediction.source_table ?? null, published_at: frozenPrediction.published_at ?? null, ranking_type: frozenPrediction.ranking_type ?? null, rank_no: frozenPrediction.rank_no ?? null } : null,
            facts: material.value,
            ai: { length: AI_LENGTH, model },
            fact_guard: { checked_fields: Object.keys(publication) },
          },
        });
        if (saved.inserted) {
          record.outcome = "created";
          record.newspaperId = saved.item.id;
        } else {
          record.outcome = "exists_concurrent";
        }
      } catch (error) {
        record.outcome = "save_failed";
        record.reason = String(error?.message || error).slice(0, 300);
      }
      break;
    }
    if (!record.outcome) record.outcome = "no_eligible_race";
  }

  const summary = {
    created: results.filter((r) => r.outcome === "created").length,
    rejected: results.filter((r) => r.outcome === "fact_guard_rejected").length,
    errors: results.filter((r) => ["ai_failed", "save_failed"].includes(r.outcome)).length,
    examined: results.reduce((sum, r) => sum + r.skipped.length + (r.courseCode ? 1 : 0), 0),
  };
  return { ok: summary.errors === 0, mode, date, generator: AUTO_DRAFT_GENERATOR, summary, results };
}

// 実行結果の記録（書き込みモードのみ）。新聞テーブルには触れない。
export async function recordAutoDraftRun(supabase, run, { error = null } = {}) {
  const details = { date: run?.date ?? null, mode: run?.mode ?? "write", generator: AUTO_DRAFT_GENERATOR, results: run?.results ?? [], ...(error ? { error: String(error).slice(0, 500) } : {}) };
  const { error: insertError } = await supabase.from("bs_news_sync_logs").insert({
    run_type: AUTO_DRAFT_LOG_TYPE,
    source: "ai_v2_daily_rankings",
    found_count: run?.summary?.examined ?? 0,
    verified_count: run?.summary?.created ?? 0,
    rejected_count: run?.summary?.rejected ?? 0,
    error_count: (run?.summary?.errors ?? 0) + (error ? 1 : 0),
    details,
  });
  if (insertError) console.error("新聞自動下書きの実行ログ保存に失敗:", insertError.message);
}
