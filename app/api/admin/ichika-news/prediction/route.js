import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STADIUMS = ["桐生","戸田","江戸川","平和島","多摩川","浜名湖","蒲郡","常滑","津","三国","びわこ","住之江","尼崎","鳴門","丸亀","児島","宮島","徳山","下関","若松","芦屋","福岡","唐津","大村"];

function validDate(v){ return /^\d{4}-\d{2}-\d{2}$/.test(String(v||"")); }

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

  const { data: ranking, error: rankingError } = await supabase
    .from("ai_v2_daily_rankings")
    .select("ranking_date,character_code,ranking_type,rank_no,course_code,race_no,probability,summary,social_comment,metrics,selected_for_social")
    .eq("ranking_date",date)
    .eq("character_code","ichika")
    .eq("ranking_type","ichika_escape_best10")
    .eq("data_timing",timing)
    .eq("course_code",courseCode)
    .eq("race_no",raceNo)
    .maybeSingle();

  if(rankingError) return NextResponse.json({ok:false,error:"ranking_read_failed"},{status:500});
  if(!ranking) return NextResponse.json({ok:true,found:false});

  const { data: prediction, error: predictionError } = await supabase
    .from("bsc_official_predictions")
    .select("tickets,unit_stake,investment,prediction_label,published_at,ranking_type,rank_no,source_table")
    .eq("race_date",date)
    .eq("course_code",courseCode)
    .eq("race_no",raceNo)
    .eq("character_code","ichika")
    .eq("timing",timing)
    .eq("source_table","ai_v2_daily_rankings")
    .eq("ranking_type","ichika_escape_best10")
    .eq("rank_no",ranking.rank_no)
    .order("published_at",{ascending:false})
    .limit(1)
    .maybeSingle();

  if(predictionError) return NextResponse.json({ok:false,error:"prediction_read_failed"},{status:500});

  const probability = Number(ranking.probability);
  const pct = Number.isFinite(probability) ? (probability * 100).toFixed(1) : "";

  return NextResponse.json({
    ok:true,
    found:true,
    frozen:Boolean(prediction),
    data:{
      rankNo:Number(ranking.rank_no),
      escapeRate:pct,
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
