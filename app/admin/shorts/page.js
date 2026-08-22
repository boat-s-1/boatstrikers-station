import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "../sync/_lib/adminAuth";
import ShortsEditor from "./ShortsEditor";
import styles from "./shorts.module.css";

export const dynamic = "force-dynamic";

const STADIUMS = {
  1: "桐生", 2: "戸田", 3: "江戸川", 4: "平和島", 5: "多摩川", 6: "浜名湖",
  7: "蒲郡", 8: "常滑", 9: "津", 10: "三国", 11: "びわこ", 12: "住之江",
  13: "尼崎", 14: "鳴門", 15: "丸亀", 16: "児島", 17: "宮島", 18: "徳山",
  19: "下関", 20: "若松", 21: "芦屋", 22: "福岡", 23: "唐津", 24: "大村",
};

function jstDate(offsetDays = 1) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadCandidates(date) {
  const supabase = getSupabase();
  if (!supabase) return { candidates: [], error: "Supabaseのサーバー環境変数がありません。" };

  const { data: rankings, error: rankingError } = await supabase
    .from("ai_v2_daily_rankings")
    .select("rank_no,course_code,race_no,probability,summary,metrics,model_version")
    .eq("ranking_date", date)
    .eq("data_timing", "previous_day")
    .eq("ranking_type", "ichika_escape_best10")
    .order("rank_no", { ascending: true })
    .limit(10);

  if (rankingError) return { candidates: [], error: rankingError.message };
  if (!rankings?.length) return { candidates: [], error: null };

  const enriched = await Promise.all(rankings.map(async (ranking) => {
    const { data: entry } = await supabase
      .from("bs_race_entries")
      .select("racer_name,racer_class,national_win_rate,local_win_rate,motor_no,motor_2_rate,motor_top2_rate,average_st,course1_average_st,course1_2_rate,course1_top2_rate,course1_races,course1_race_count")
      .eq("race_date", date)
      .eq("course_code", ranking.course_code)
      .eq("race_no", ranking.race_no)
      .eq("boat_no", 1)
      .maybeSingle();

    return {
      ...ranking,
      stadium: STADIUMS[Number(ranking.course_code)] || `${ranking.course_code}場`,
      racer: entry ? {
        ...entry,
        motor_2_rate: entry.motor_top2_rate ?? entry.motor_2_rate,
        course1_2_rate: entry.course1_top2_rate ?? entry.course1_2_rate,
        course1_races: entry.course1_race_count ?? entry.course1_races,
      } : null,
    };
  }));

  return { candidates: enriched, error: null };
}

export default async function ShortsPage({ searchParams }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
  const params = await searchParams;
  const date = validDate(params?.date) ? params.date : jstDate(1);
  const { candidates, error } = await loadCandidates(date);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span>BOATSTRIKERS SHORTS STUDIO</span>
            <h1>ショート動画生成</h1>
            <p>一果の前日イン逃げ予想を、公式ナレーターが紹介する縦型動画にします。</p>
          </div>
          <Link href="/admin" className={styles.back}>管理トップへ</Link>
        </header>

        <section className={styles.filterCard}>
          <form method="get">
            <label><span>予想対象日</span><input type="date" name="date" defaultValue={date} /></label>
            <button type="submit">前日版を読み込む</button>
          </form>
          <div className={styles.source}>AI v2 前日版・一果イン逃げBEST10</div>
        </section>

        {error && <div className={styles.error}>取得エラー：{error}</div>}
        {!error && candidates.length === 0 ? (
          <section className={styles.empty}>
            <strong>{date}の前日予想はまだありません。</strong>
            <p>AI v2の前日版生成が完了したあと、もう一度読み込んでください。</p>
          </section>
        ) : (
          <ShortsEditor date={date} candidates={candidates} />
        )}
      </div>
    </main>
  );
}
