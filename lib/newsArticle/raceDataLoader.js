// DATA CHECK 用のレースデータ取得（読み取り専用）。select だけを使い、DB への書き込みは行わない。
// 記事1件ぶん（開催場・公開日の前後数日）に絞って読む。PHASE 1 では検証スクリプトからのみ使う想定。

const ENTRY_COLUMNS = "race_date,course_code,race_no,boat_no,racer_registration_no,racer_name,racer_class,motor_no,motor_2_rate,actual_course,actual_start_timing,arrival_order,finish_place";
const EVENT_COLUMNS = "race_date,course_code,race_no,race_day_no,race_name,race_kind_code,closing_time,trifecta,trifecta_payout,trifecta_popularity";
const RESULT_COLUMNS = "race_date,course_code,race_no,winning_technique,winning_trifecta,trifecta_payout,trifecta_popularity";

function throwIf(error, label) {
  if (error) throw new Error(`${label}: ${error.message || error}`);
}

// courseCode が無い（日次まとめ等）場合は、レース単位のデータを読まない。
export async function loadNewsRaceData(supabase, { courseCode = null, from, to, digestDate = null } = {}) {
  const result = { entries: [], races: [], grades: [], digests: [] };
  if (!supabase) return result;
  if (courseCode && from && to) {
    const [entries, events, results, grades] = await Promise.all([
      supabase.from("bs_race_entries").select(ENTRY_COLUMNS).eq("course_code", courseCode).gte("race_date", from).lte("race_date", to).limit(2000),
      supabase.from("bs_race_events").select(EVENT_COLUMNS).eq("course_code", courseCode).gte("race_date", from).lte("race_date", to).limit(500),
      supabase.from("bs_race_results").select(RESULT_COLUMNS).eq("course_code", courseCode).gte("race_date", from).lte("race_date", to).limit(500),
      supabase.from("bs_grade_race_events").select("start_date,end_date,course_code,grade,title").eq("course_code", courseCode).lte("start_date", to).gte("end_date", from),
    ]);
    throwIf(entries.error, "bs_race_entries");
    throwIf(events.error, "bs_race_events");
    throwIf(results.error, "bs_race_results");
    throwIf(grades.error, "bs_grade_race_events");
    const resultByKey = new Map((results.data || []).map((r) => [`${r.race_date}|${r.course_code}|${r.race_no}`, r]));
    result.entries = entries.data || [];
    // 決まり手・3連単は bs_race_results を優先する（bs_race_events の決まり手コードは使わない）。
    result.races = (events.data || []).map((e) => {
      const r = resultByKey.get(`${e.race_date}|${e.course_code}|${e.race_no}`) || {};
      return { ...e, winning_technique: r.winning_technique ?? null, winning_trifecta: r.winning_trifecta ?? null, trifecta_payout: r.trifecta_payout ?? e.trifecta_payout, trifecta_popularity: r.trifecta_popularity ?? e.trifecta_popularity };
    });
    result.grades = grades.data || [];
  }
  if (digestDate) {
    const digests = await supabase.from("bs_daily_result_digests").select("race_date,race_count,venue_count,manshu_count,max_payout,manshu").eq("race_date", digestDate).limit(1);
    throwIf(digests.error, "bs_daily_result_digests");
    result.digests = digests.data || [];
  }
  return result;
}
