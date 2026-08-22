import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "../sync/_lib/adminAuth";
import NewsEditor from "./NewsEditor";
import styles from "./news.module.css";

export const dynamic = "force-dynamic";

const STADIUMS = {
  1: "桐生", 2: "戸田", 3: "江戸川", 4: "平和島", 5: "多摩川", 6: "浜名湖",
  7: "蒲郡", 8: "常滑", 9: "津", 10: "三国", 11: "びわこ", 12: "住之江",
  13: "尼崎", 14: "鳴門", 15: "丸亀", 16: "児島", 17: "宮島", 18: "徳山",
  19: "下関", 20: "若松", 21: "芦屋", 22: "福岡", 23: "唐津", 24: "大村",
};

const RANKING_TYPES = ["ichika_escape_best10", "hatsune_dominant_best3", "hatsune_risky_best3", "kiina_boat5_best5"];

function jstDate(offsetDays = 1) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")); }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadPreviousDay(date) {
  const supabase = getSupabase();
  if (!supabase) return { candidateSets: {}, dataError: "Supabaseのサーバー環境変数がありません。" };
  const { data: rankings, error } = await supabase
    .from("ai_v2_daily_rankings")
    .select("ranking_type,rank_no,course_code,race_no,probability,summary,metrics,model_version")
    .eq("ranking_date", date)
    .eq("data_timing", "previous_day")
    .in("ranking_type", RANKING_TYPES)
    .order("rank_no", { ascending: true });
  if (error) return { candidateSets: {}, dataError: error.message };

  const enriched = await Promise.all((rankings || []).map(async (ranking) => {
    const boatNo = ranking.ranking_type === "kiina_boat5_best5" ? 5 : 1;
    const { data: entry } = await supabase
      .from("bs_race_entries")
      .select("racer_name,racer_class,motor_no,motor_2_rate,motor_top2_rate,average_st,course1_average_st,course1_2_rate,course1_top2_rate")
      .eq("race_date", date).eq("course_code", ranking.course_code).eq("race_no", ranking.race_no).eq("boat_no", boatNo).maybeSingle();
    return { ...ranking, stadium: STADIUMS[Number(ranking.course_code)] || `${ranking.course_code}場`, boatNo, racer: entry || null };
  }));
  return {
    candidateSets: Object.fromEntries(RANKING_TYPES.map((type) => [type, enriched.filter((row) => row.ranking_type === type)])),
    dataError: null,
  };
}

export default async function NewsPage({ searchParams }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
  const params = await searchParams;
  const date = validDate(params?.date) ? params.date : jstDate(1);
  const { candidateSets, dataError } = await loadPreviousDay(date);
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div><span>BOATSTRIKERS NEWS STUDIO</span><h1>深夜のBoatStrikersニュース</h1><p>キャスターと3つのニュースを選ぶだけで、音声付きの縦型動画を作成します。</p></div>
          <Link href="/admin" className={styles.back}>管理トップへ</Link>
        </header>
        <NewsEditor initialDate={date} candidateSets={candidateSets} dataError={dataError} />
      </div>
    </main>
  );
}
