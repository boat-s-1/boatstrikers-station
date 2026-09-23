import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STADIUMS = ["桐生","戸田","江戸川","平和島","多摩川","浜名湖","蒲郡","常滑","津","三国","びわこ","住之江","尼崎","鳴門","丸亀","児島","宮島","徳山","下関","若松","芦屋","福岡","唐津","大村"];
const TYPES = ["hatsune_dominant_best3","hatsune_risky_best3"];

function validDate(v){ return /^\d{4}-\d{2}-\d{2}$/.test(String(v||"")); }
function num(v, { allowZero = false, allowNegative = false } = {}) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (!allowNegative && n < 0) return null;
  if (!allowZero && n === 0) return null;
  return n;
}
function fixed(v, digits = 2) {
  return Number(v).toFixed(digits).replace(/\.00$/, "");
}
function normalize(values, value, lowerIsBetter = false) {
  const valid = values.filter((v) => v !== null);
  if (!valid.length || value === null) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return 0.5;
  const ratio = (value - min) / (max - min);
  return lowerIsBetter ? 1 - ratio : ratio;
}
function bestEntry(entries, key, { lower = false, allowZero = false, allowNegative = false, boats = null } = {}) {
  const pool = entries
    .filter((e) => !boats || boats.includes(Number(e.boat_no)))
    .map((e) => ({ entry: e, value: num(e[key], { allowZero, allowNegative }) }))
    .filter((x) => x.value !== null)
    .sort((a, b) => lower ? a.value - b.value : b.value - a.value);
  return pool[0] || null;
}
function compositeScore(entries, entry, timing) {
  const metrics = [
    ["national_win_rate", 0.30, false, false],
    ["local_win_rate", 0.25, false, false],
    ["motor_top2_rate", 0.20, false, false],
    ["race_boat_top2_rate", 0.10, false, false],
    ["average_st", 0.15, true, false],
  ];
  if (timing === "after_exhibition") {
    metrics.push(["official_exhibition_time", 0.20, true, false]);
    metrics.push(["official_exhibition_st", 0.10, true, true]);
  }

  let weighted = 0;
  let totalWeight = 0;
  for (const [key, weight, lowerIsBetter, allowZero] of metrics) {
    const value = num(entry[key], { allowZero, allowNegative: false });
    if (value === null) continue;
    const values = entries.map((e) => num(e[key], { allowZero, allowNegative: false }));
    const normalized = normalize(values, value, lowerIsBetter);
    if (normalized === null) continue;
    weighted += normalized * weight;
    totalWeight += weight;
  }
  return totalWeight ? weighted / totalWeight : 0;
}
function buildRaceInsights(entries, category, timing) {
  if (!entries.length) {
    return {
      featuredBoat: "1",
      checkpoints: ["艇別データを確認", "スタートデータを確認", "モーター気配を確認"],
    };
  }

  let featured;
  if (category === "イン逃げが圧倒的") {
    featured = entries.find((e) => Number(e.boat_no) === 1) || entries[0];
  } else {
    const challengers = entries.filter((e) => Number(e.boat_no) !== 1);
    featured = (challengers.length ? challengers : entries)
      .map((entry) => ({ entry, score: compositeScore(entries, entry, timing) }))
      .sort((a, b) => b.score - a.score)[0]?.entry || entries[0];
  }

  const points = [];
  const push = (text) => {
    if (text && !points.includes(text) && points.length < 3) points.push(text);
  };

  if (timing === "after_exhibition") {
    const exTime = bestEntry(entries, "official_exhibition_time", { lower: true });
    if (exTime) push(`${exTime.entry.boat_no}号艇 展示タイム${fixed(exTime.value, 2)}`);
    const exSt = bestEntry(entries, "official_exhibition_st", { lower: true, allowZero: true });
    if (exSt) push(`${exSt.entry.boat_no}号艇 展示ST${fixed(exSt.value, 2)}`);
    const straight = bestEntry(entries, "official_straight", { lower: true });
    if (straight) push(`${straight.entry.boat_no}号艇 直線${fixed(straight.value, 2)}`);
  }

  const featuredLocal = num(featured.local_win_rate);
  const featuredNational = num(featured.national_win_rate);
  if (featuredLocal !== null) push(`${featured.boat_no}号艇 当地勝率${fixed(featuredLocal, 2)}`);
  else if (featuredNational !== null) push(`${featured.boat_no}号艇 全国勝率${fixed(featuredNational, 2)}`);

  const avgSt = bestEntry(entries, "average_st", { lower: true });
  if (avgSt) push(`${avgSt.entry.boat_no}号艇 平均ST${fixed(avgSt.value, 2)}`);

  const motor = bestEntry(entries, "motor_top2_rate");
  if (motor) push(`${motor.entry.boat_no}号艇 モーター2連率${fixed(motor.value, 1)}%`);

  const local = bestEntry(entries, "local_win_rate");
  if (local) push(`${local.entry.boat_no}号艇 当地勝率${fixed(local.value, 2)}`);

  const national = bestEntry(entries, "national_win_rate");
  if (national) push(`${national.entry.boat_no}号艇 全国勝率${fixed(national.value, 2)}`);

  while (points.length < 3) {
    const fallback = ["艇別データを確認", "スタートデータを確認", "モーター気配を確認"][points.length];
    push(fallback);
  }

  return {
    featuredBoat: String(featured.boat_no || 1),
    checkpoints: points.slice(0, 3),
  };
}

export async function GET(request){
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const course = searchParams.get("course");
  const raceNo = Number(searchParams.get("raceNo"));
  const timing = searchParams.get("timing") === "after_exhibition" ? "after_exhibition" : "previous_day";
  const courseCode = STADIUMS.indexOf(course) + 1;

  if(!validDate(date) || courseCode < 1 || !Number.isInteger(raceNo) || raceNo < 1 || raceNo > 12){
    return NextResponse.json({ok:false,error:"invalid_params"},{status:400});
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url || !key) return NextResponse.json({ok:false,error:"supabase_config_missing"},{status:500});

  const supabase = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

  const { data: rankings, error: rankingError } = await supabase
    .from("ai_v2_daily_rankings")
    .select("ranking_date,character_code,ranking_type,rank_no,course_code,race_no,probability,summary,social_comment,selected_for_social,data_timing")
    .eq("ranking_date",date)
    .eq("character_code","hatsune")
    .eq("data_timing",timing)
    .eq("course_code",courseCode)
    .eq("race_no",raceNo)
    .in("ranking_type",TYPES)
    .order("rank_no",{ascending:true});

  if(rankingError) return NextResponse.json({ok:false,error:"ranking_read_failed"},{status:500});
  if(!rankings?.length) return NextResponse.json({ok:true,found:false});

  const ranking = rankings[0];
  const category = ranking.ranking_type === "hatsune_dominant_best3" ? "イン逃げが圧倒的" : "インが不安";

  const { data: prediction, error: predictionError } = await supabase
    .from("bsc_official_predictions")
    .select("tickets,unit_stake,investment,prediction_label,published_at,ranking_type,rank_no,source_table")
    .eq("race_date",date)
    .eq("course_code",courseCode)
    .eq("race_no",raceNo)
    .eq("character_code","hatsune")
    .eq("timing",timing)
    .eq("source_table","ai_v2_daily_rankings")
    .eq("ranking_type",ranking.ranking_type)
    .eq("rank_no",ranking.rank_no)
    .order("published_at",{ascending:false})
    .limit(1)
    .maybeSingle();

  if(predictionError) return NextResponse.json({ok:false,error:"prediction_read_failed"},{status:500});

  const { data: entries, error: entryError } = await supabase
    .from("bs_race_entries")
    .select("boat_no,national_win_rate,local_win_rate,average_st,motor_top2_rate,race_boat_top2_rate,course1_average_st,course1_top2_rate,course1_race_count,official_exhibition_time,official_exhibition_st,official_half_lap,official_lap,official_turn,official_straight")
    .eq("race_date", date)
    .eq("course_code", courseCode)
    .eq("race_no", raceNo)
    .order("boat_no", { ascending: true });

  if(entryError) return NextResponse.json({ok:false,error:"entry_read_failed"},{status:500});

  const probability = Number(ranking.probability);
  const expectation = Number.isFinite(probability) ? (probability * 100).toFixed(1) : "";
  const insights = buildRaceInsights(entries || [], category, timing);

  return NextResponse.json({
    ok:true,
    found:true,
    frozen:Boolean(prediction),
    data:{
      rankNo:Number(ranking.rank_no),
      rankingType:ranking.ranking_type,
      category,
      expectation,
      featuredBoat:insights.featuredBoat,
      checkpoints:insights.checkpoints,
      summary:ranking.summary || "",
      socialComment:ranking.social_comment || "",
      selectedForSocial:Boolean(ranking.selected_for_social),
      tickets:Array.isArray(prediction?.tickets) ? prediction.tickets : [],
      unitStake:Number(prediction?.unit_stake || 0),
      investment:Number(prediction?.investment || 0),
      predictionLabel:prediction?.prediction_label || "",
      publishedAt:prediction?.published_at || null,
      timing
    }
  });
}
