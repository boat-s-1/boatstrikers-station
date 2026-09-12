import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const COURSE_NAMES = {
  1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",
  13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村",
};

const CHARACTER_LABELS = { ichika: "一果", hatsune: "初音", kiina: "キイナ" };

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function currentMonthRange() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { start, next };
}

function compactFormation(tickets) {
  const list = Array.isArray(tickets) ? tickets.filter(Boolean) : [];
  if (!list.length) return "";
  const parsed = list.map((ticket) => String(ticket).split("-")).filter((parts) => parts.length === 3);
  if (parsed.length !== list.length) return list.join(" / ");
  const first = new Set(parsed.map((parts) => parts[0]));
  const second = new Set(parsed.map((parts) => parts[1]));
  const third = new Set(parsed.map((parts) => parts[2]));
  if (first.size === 1 && second.size === 1) return `${parsed[0][0]}-${parsed[0][1]}-${[...third].sort().join("")}`;
  if (first.size === 1 && third.size === 1) return `${parsed[0][0]}-${[...second].sort().join("")}-${parsed[0][2]}`;
  return list.join(" / ");
}

function raceKey(row) {
  return `${row.race_date}-${Number(row.course_code)}-${Number(row.race_no)}`;
}

function edgeCount(length) {
  if (length <= 1) return 1;
  return Math.min(3, Math.max(1, Math.ceil(length / 3)));
}

function stakesFromRankedTickets(rankedTickets) {
  const count = rankedTickets.length;
  if (!count) return {};
  const edge = edgeCount(count);
  const stakes = {};
  rankedTickets.forEach((ticket, index) => {
    if (index < edge) stakes[ticket] = 300;
    else if (index >= count - edge) stakes[ticket] = 100;
    else stakes[ticket] = 200;
  });
  return stakes;
}

function equalStakes(tickets) {
  return Object.fromEntries((Array.isArray(tickets) ? tickets : []).map((ticket) => [ticket, 100]));
}

function confidenceStakes(tickets, snapshot) {
  const list = Array.isArray(tickets) ? tickets : [];
  const scoreRows = Array.isArray(snapshot?.ticket_scores) ? snapshot.ticket_scores : [];
  const scoreMap = new Map(scoreRows.map((item) => [String(item.ticket), Number(item.score || 0)]));
  const ranked = [...list].sort((a, b) => (scoreMap.get(String(b)) || 0) - (scoreMap.get(String(a)) || 0));
  return stakesFromRankedTickets(ranked);
}

function oddsStakes(tickets, odds) {
  const list = Array.isArray(tickets) ? tickets : [];
  if (!odds || typeof odds !== "object") return null;
  const ranked = list
    .filter((ticket) => Number.isFinite(Number(odds[ticket])) && Number(odds[ticket]) > 0)
    .sort((a, b) => Number(odds[a]) - Number(odds[b]));
  if (ranked.length !== list.length || !ranked.length) return null;
  return stakesFromRankedTickets(ranked);
}

function applyStrategy(row, stakes) {
  const tickets = Array.isArray(row.tickets) ? row.tickets : [];
  const investment = tickets.reduce((sum, ticket) => sum + Number(stakes?.[ticket] || 0), 0);
  const hitTicket = row.is_hit ? String(row.result_combination || "") : "";
  const hitStake = hitTicket ? Number(stakes?.[hitTicket] || 0) : 0;
  const payout = row.settled_at && hitStake > 0 ? Math.round(Number(row.trifecta_payout || 0) * (hitStake / 100)) : 0;
  return { ...row, investment, payout, strategy_stakes: stakes, strategy_hit_stake: hitStake };
}

function summarize(rows) {
  const settled = rows.filter((row) => row.settled_at);
  const totalRace = settled.length;
  const hits = settled.filter((row) => Boolean(row.is_hit));
  const investment = settled.reduce((sum, row) => sum + Number(row.investment || 0), 0);
  const payout = settled.reduce((sum, row) => sum + Number(row.payout || 0), 0);
  return {
    totalRace,
    hitRace: hits.length,
    hitRate: totalRace ? (hits.length / totalRace) * 100 : 0,
    investment,
    payout,
    recoveryRate: investment ? (payout / investment) * 100 : 0,
    maxPayout: settled.reduce((max, row) => Math.max(max, Number(row.payout || 0)), 0),
  };
}

function toBetCard(row) {
  return {
    predictionId: row.prediction_id,
    raceDate: row.race_date,
    courseCode: Number(row.course_code),
    courseName: COURSE_NAMES[Number(row.course_code)] || `${row.course_code}場`,
    raceNo: Number(row.race_no),
    characterCode: row.character_code,
    characterLabel: CHARACTER_LABELS[row.character_code] || row.character_code,
    tickets: Array.isArray(row.tickets) ? row.tickets : [],
    formation: compactFormation(row.tickets),
    investment: Number(row.investment || 0),
    resultCombination: row.result_combination,
    isHit: row.settled_at ? Boolean(row.is_hit) : null,
    payout: Number(row.payout || 0),
    stakes: row.strategy_stakes || {},
  };
}

export async function GET() {
  const supabase = getClient();
  if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  try {
    const { start, next } = currentMonthRange();
    const [performanceRes, predictionsRes, oddsRes] = await Promise.all([
      supabase
        .from("v_bsc_official_performance")
        .select("prediction_id,race_date,course_code,race_no,character_code,timing,tickets,result_combination,trifecta_payout,is_hit,settled_at")
        .gte("race_date", start).lt("race_date", next).eq("timing", "previous_day")
        .order("race_date", { ascending: false }).order("prediction_id", { ascending: false }),
      supabase.from("bsc_official_predictions").select("id,snapshot").gte("race_date", start).lt("race_date", next).eq("timing", "previous_day"),
      supabase.from("bs_elimination_odds_snapshots").select("race_date,course_code,race_no,captured_at,odds").gte("race_date", start).lt("race_date", next).order("captured_at", { ascending: true }),
    ]);

    if (performanceRes.error) throw performanceRes.error;
    if (predictionsRes.error) throw predictionsRes.error;

    const rows = Array.isArray(performanceRes.data) ? performanceRes.data : [];
    const predictionMap = new Map((predictionsRes.data || []).map((item) => [Number(item.id), item.snapshot || {}]));

    const earliestOddsByRace = new Map();
    if (!oddsRes.error) {
      (oddsRes.data || []).forEach((item) => {
        const key = raceKey(item);
        if (!earliestOddsByRace.has(key)) earliestOddsByRace.set(key, item);
      });
    }

    const equalRows = rows.map((row) => applyStrategy(row, equalStakes(row.tickets)));
    const confidenceRows = rows.map((row) => applyStrategy(row, confidenceStakes(row.tickets, predictionMap.get(Number(row.prediction_id)))));

    const oddsRows = rows
      .map((row) => {
        const snapshot = earliestOddsByRace.get(raceKey(row));
        const stakes = oddsStakes(row.tickets, snapshot?.odds);
        return stakes ? applyStrategy(row, stakes) : null;
      })
      .filter(Boolean);

    const equalStats = summarize(equalRows);
    const confidenceStats = summarize(confidenceRows);
    const oddsStats = summarize(oddsRows);

    return NextResponse.json({
      modes: {
        equal: {
          ready: true,
          stats: equalStats,
          bets: equalRows.slice(0, 16).map(toBetCard),
          rule: "全買い目100円",
        },
        confidence: {
          ready: true,
          stats: confidenceStats,
          bets: confidenceRows.slice(0, 16).map(toBetCard),
          rule: "自信上位300円・中間200円・下位100円",
        },
        odds: {
          ready: oddsRows.length > 0,
          stats: oddsRows.length ? oddsStats : null,
          bets: oddsRows.slice(0, 16).map(toBetCard),
          rule: "低オッズ側300円・中間200円・高オッズ側100円",
          coverageRaceCount: oddsRows.length,
          totalRaceCount: rows.length,
        },
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("home performance api error", error);
    return NextResponse.json({ error: "performance_fetch_failed" }, { status: 500 });
  }
}
