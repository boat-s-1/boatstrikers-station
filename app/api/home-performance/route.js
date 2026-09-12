import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const COURSE_NAMES = {
  1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",
  13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村",
};

const CHARACTER_LABELS = {
  ichika: "一果",
  hatsune: "初音",
  kiina: "キイナ",
};

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function currentMonthRange() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { start, next };
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
    maxPayout: settled.reduce((max, row) => Math.max(max, Number(row.trifecta_payout || 0)), 0),
  };
}

function compactFormation(tickets) {
  const list = Array.isArray(tickets) ? tickets.filter(Boolean) : [];
  if (!list.length) return "";
  const parsed = list.map((ticket) => String(ticket).split("-")).filter((parts) => parts.length === 3);
  if (parsed.length !== list.length) return list.join(" / ");

  const first = new Set(parsed.map((parts) => parts[0]));
  const second = new Set(parsed.map((parts) => parts[1]));
  const third = new Set(parsed.map((parts) => parts[2]));

  if (first.size === 1 && second.size === 1) {
    return `${parsed[0][0]}-${parsed[0][1]}-${[...third].sort().join("")}`;
  }
  if (first.size === 1 && third.size === 1) {
    return `${parsed[0][0]}-${[...second].sort().join("")}-${parsed[0][2]}`;
  }

  return list.join(" / ");
}

export async function GET() {
  const supabase = getClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  try {
    const { start, next } = currentMonthRange();
    const { data, error } = await supabase
      .from("v_bsc_official_performance")
      .select("prediction_id,race_date,course_code,race_no,character_code,timing,tickets,investment,result_combination,trifecta_payout,is_hit,payout,settled_at")
      .gte("race_date", start)
      .lt("race_date", next)
      .eq("timing", "previous_day")
      .order("race_date", { ascending: false })
      .order("prediction_id", { ascending: false });

    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    const equalStats = summarize(rows);
    const bets = rows.slice(0, 16).map((row) => ({
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
    }));

    return NextResponse.json({
      modes: {
        equal: { ready: true, stats: equalStats, bets },
        confidence: { ready: false, stats: null, bets: [] },
        odds: { ready: false, stats: null, bets: [] },
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("home performance api error", error);
    return NextResponse.json({ error: "performance_fetch_failed" }, { status: 500 });
  }
}
