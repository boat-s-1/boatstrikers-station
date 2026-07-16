import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const error = new Error("Supabase環境変数が未設定です");
    error.status = 500;
    throw error;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function assertAdmin(request) {
  const expected = process.env.BSC_AI_ADMIN_KEY;
  const received = request.headers.get("x-bsc-ai-key");

  if (!expected) {
    const error = new Error("BSC_AI_ADMIN_KEYが未設定です");
    error.status = 500;
    throw error;
  }

  if (!received || received !== expected) {
    const error = new Error("認証に失敗しました");
    error.status = 401;
    throw error;
  }
}

export async function GET(request) {
  try {
    assertAdmin(request);

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "dateが必要です" },
        { status: 400 },
      );
    }

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("v_ai_diagnosis_ranking_v3")
      .select(
        [
          "id",
          "daily_rank",
          "race_date",
          "stadium_code",
          "race_no",
          "star_count",
          "star_label",
          "diagnosis_code",
          "diagnosis_label",
          "total_score",
          "ichika_probability",
          "hatsune_probability",
          "kiina_probability",
          "inside_expectation",
          "hole_expectation",
          "danger_score",
          "consensus_score",
          "comments",
          "warnings",
          "tickets",
          "contributions",
          "diagnosis_version",
          "generated_at",
        ].join(","),
      )
      .eq("race_date", date)
      .order("daily_rank", { ascending: true });

    if (error) {
      throw error;
    }

    const races = data || [];
    const scores = races.map((race) => Number(race.total_score || 0));

    const summary = {
      totalRaces: races.length,
      maxScore: scores.length ? Math.max(...scores) : 0,
      averageScore:
        scores.length > 0
          ? scores.reduce((total, score) => total + score, 0) / scores.length
          : 0,
      fiveStarCount: races.filter(
        (race) => Number(race.star_count) === 5,
      ).length,
      skipCount: races.filter(
        (race) =>
          race.diagnosis_code === "skip" ||
          Number(race.star_count) === 1,
      ).length,
      diagnosisVersion: races[0]?.diagnosis_version || null,
      generatedAt: races[0]?.generated_at || null,
    };

    return NextResponse.json({
      date,
      summary,
      races,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "AI診断ダッシュボードの取得に失敗しました",
      },
      {
        status: error?.status || 500,
      },
    );
  }
}
