import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMINGS = ["previous_day", "after_exhibition"];
const MODE_META = {
  oni: "鬼絞り",
  hit: "的中率",
  recovery: "回収率",
  hole: "穴狙い",
};

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function jstDateOffset(offsetDays = 0) {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCDate(jst.getUTCDate() + offsetDays);
  return jst.toISOString().slice(0, 10);
}

function normalizeResult(row) {
  const direct = String(row?.trifecta_result || row?.winning_trifecta || "").trim();
  if (/^\d-\d-\d$/.test(direct)) return direct;
  if (row?.first_boat && row?.second_boat && row?.third_boat) {
    return `${row.first_boat}-${row.second_boat}-${row.third_boat}`;
  }
  return null;
}

function modeTickets(top) {
  if (!Array.isArray(top) || top.length < 4) return null;
  const first = Number(top[0]);
  const a = Number(top[1]);
  const b = Number(top[2]);
  const c = Number(top[3]);
  if (![first, a, b, c].every((v) => Number.isInteger(v) && v >= 1 && v <= 6)) return null;

  return {
    oni: [`1-${a}-${b}`, `1-${b}-${a}`],
    hit: [`1-${a}-全`, `1-${b}-全`],
    recovery: [
      `1-${a}-${b}`, `1-${b}-${a}`,
      `1-${a}-${c}`, `1-${c}-${a}`,
      `1-${b}-${c}`, `1-${c}-${b}`,
    ],
    hole: [`${b}-${a}-全`, `${b}-1-全`],
  };
}

function ticketHits(ticket, result) {
  if (!ticket || !result) return false;
  if (!ticket.includes("全")) return ticket === result;
  const [t1, t2] = ticket.split("-");
  const [r1, r2] = result.split("-");
  return t1 === r1 && t2 === r2;
}

async function fetchPredictions(supabase, date) {
  const { data, error } = await supabase
    .from("bs_ai_predictions")
    .select("id,race_date,course_code,race_no,timing,character_code,detail_json")
    .eq("race_date", date)
    .eq("character_code", "ichika")
    .in("timing", TIMINGS)
    .order("id", { ascending: false });
  if (error) throw error;

  const latest = new Map();
  for (const row of data || []) {
    const key = `${row.race_date}:${row.course_code}:${row.race_no}:${row.timing}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()];
}

async function fetchResults(supabase, date) {
  const { data, error } = await supabase
    .from("bs_race_results")
    .select("race_date,course_code,race_no,trifecta_result,winning_trifecta,trifecta_payout,first_boat,second_boat,third_boat")
    .eq("race_date", date);
  if (error) throw error;
  return new Map((data || []).map((row) => [`${row.course_code}:${row.race_no}`, row]));
}

async function settleDate(supabase, date) {
  const [predictions, resultMap] = await Promise.all([
    fetchPredictions(supabase, date),
    fetchResults(supabase, date),
  ]);

  const settledAt = new Date().toISOString();
  const rows = [];

  for (const prediction of predictions) {
    const resultRow = resultMap.get(`${prediction.course_code}:${prediction.race_no}`);
    const resultCombination = normalizeResult(resultRow);
    const trifectaPayout = Number(resultRow?.trifecta_payout || 0);
    if (!resultCombination || !trifectaPayout) continue;

    const top = prediction.detail_json?.top_first_probability_boats;
    const ticketsByMode = modeTickets(top);
    if (!ticketsByMode) continue;

    for (const [modeKey, tickets] of Object.entries(ticketsByMode)) {
      const hitTicket = tickets.find((ticket) => ticketHits(ticket, resultCombination)) || null;
      const isHit = Boolean(hitTicket);
      const investment = tickets.length * 100;
      const payout = isHit ? trifectaPayout : 0;

      rows.push({
        race_date: prediction.race_date,
        course_code: prediction.course_code,
        race_no: prediction.race_no,
        prediction_timing: prediction.timing,
        prediction_id: prediction.id,
        mode_key: modeKey,
        mode_name: MODE_META[modeKey],
        tickets,
        ticket_count: tickets.length,
        unit_stake: 100,
        investment,
        result_combination: resultCombination,
        trifecta_payout: trifectaPayout,
        is_hit: isHit,
        hit_ticket: hitTicket,
        payout,
        profit: payout - investment,
        recovery_rate: investment > 0 ? Number(((payout / investment) * 100).toFixed(1)) : 0,
        settled_at: settledAt,
        updated_at: settledAt,
      });
    }
  }

  if (!rows.length) return { date, predictions: predictions.length, settled: 0 };

  const { error } = await supabase
    .from("bs_ai_bet_results")
    .upsert(rows, {
      onConflict: "race_date,course_code,race_no,prediction_timing,mode_key",
      ignoreDuplicates: false,
    });
  if (error) throw error;

  return { date, predictions: predictions.length, settled: rows.length };
}

export async function GET() {
  try {
    const supabase = getClient();
    const dates = [jstDateOffset(0), jstDateOffset(-1), jstDateOffset(-2)];
    const results = [];
    for (const date of dates) results.push(await settleDate(supabase, date));
    return NextResponse.json({ ok: true, timings: TIMINGS, results });
  } catch (error) {
    console.error("AI bet settlement failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
