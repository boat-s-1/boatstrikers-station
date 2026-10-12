// DATA CHECK 用のレースデータ取得（読み取り専用）。select だけを使い、DB への書き込みは行わない。
// 呼び出し側は公開用の anon キーのクライアントを渡す（RLS で読み取りだけが許可され、書き込みはできない）。
// 記事1件ぶん（開催場・公開日の6日前〜公開日）に絞って読む。取得件数が上限に達した表は meta.truncated に記録し、照合に使わない。

const PAGE_SIZE = 1000; // PostgREST の既定の最大件数
const ENTRY_COLUMNS = "race_date,course_code,race_no,boat_no,racer_registration_no,racer_name,racer_class,motor_no,motor_2_rate,actual_course,actual_start_timing,arrival_order,finish_place";
const EVENT_COLUMNS = "race_date,course_code,race_no,race_day_no,race_name,race_kind_code,closing_time,trifecta,trifecta_payout,trifecta_popularity";
const RESULT_COLUMNS = "race_date,course_code,race_no,winning_technique,winning_trifecta,trifecta_payout,trifecta_popularity";
// 日次まとめの照合用。winning_technique_code は2種類のコード体系が混在しているため読まない。
const DAILY_EVENT_COLUMNS = "race_date,course_code,course_name,race_no,closing_time,trifecta,trifecta_payout,race_cancel_code";

function check(response, label, meta) {
  if (response.error) throw new Error(`${label}: ${response.error.message || response.error}`);
  const rows = response.data || [];
  if (rows.length >= PAGE_SIZE) meta.truncated.push(label);
  return rows;
}

export function raceDataKey(request) {
  if (!request) return "";
  return request.digestDate ? `digest:${request.digestDate}` : `${request.courseCode}:${request.from}:${request.to}`;
}

export async function loadNewsRaceData(supabase, { courseCode = null, from, to, digestDate = null } = {}) {
  const meta = { truncated: [], request: { courseCode, from, to, digestDate } };
  const result = { entries: [], races: [], grades: [], digests: [], dailyEvents: [], meta };
  if (!supabase) return result;
  if (courseCode && from && to) {
    const [entries, events, results, grades] = await Promise.all([
      supabase.from("bs_race_entries").select(ENTRY_COLUMNS).eq("course_code", courseCode).gte("race_date", from).lte("race_date", to).order("race_date").order("race_no").order("boat_no").range(0, PAGE_SIZE - 1),
      supabase.from("bs_race_events").select(EVENT_COLUMNS).eq("course_code", courseCode).gte("race_date", from).lte("race_date", to).order("race_date").order("race_no").range(0, PAGE_SIZE - 1),
      supabase.from("bs_race_results").select(RESULT_COLUMNS).eq("course_code", courseCode).gte("race_date", from).lte("race_date", to).order("race_date").order("race_no").range(0, PAGE_SIZE - 1),
      // anon キーでは RLS により 0 件になる（グレードは「未確認」扱い）。
      supabase.from("bs_grade_race_events").select("start_date,end_date,course_code,grade,title").eq("course_code", courseCode).lte("start_date", to).gte("end_date", from),
    ]);
    result.entries = check(entries, "bs_race_entries", meta);
    const eventRows = check(events, "bs_race_events", meta);
    const resultRows = check(results, "bs_race_results", meta);
    result.grades = grades.error ? [] : grades.data || [];
    const resultByKey = new Map(resultRows.map((r) => [`${r.race_date}|${r.course_code}|${r.race_no}`, r]));
    // 決まり手・3連単は bs_race_results を優先する（bs_race_events の決まり手コードは使わない）。
    result.races = eventRows.map((e) => {
      const r = resultByKey.get(`${e.race_date}|${e.course_code}|${e.race_no}`) || {};
      return { ...e, winning_technique: r.winning_technique ?? null, winning_trifecta: r.winning_trifecta ?? null, trifecta_payout: r.trifecta_payout ?? e.trifecta_payout, trifecta_popularity: r.trifecta_popularity ?? e.trifecta_popularity };
    });
  }
  if (digestDate) {
    const daily = await supabase.from("bs_race_events").select(DAILY_EVENT_COLUMNS).eq("race_date", digestDate).order("course_code").order("race_no").range(0, PAGE_SIZE - 1);
    result.dailyEvents = check(daily, "bs_race_events(日次)", meta);
  }
  return result;
}
