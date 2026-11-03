// Read-only access to the race tables for BLOG datasets. Only SELECT is ever issued: the client is wrapped so that
// insert/update/upsert/delete/rpc are not reachable from here. Columns are listed explicitly.

export const RESULT_COLUMNS = "race_date,course_code,race_no,result_status,trifecta_result,winning_trifecta,first_boat,trifecta_payout,winning_technique,winning_method";
export const EVENT_COLUMNS = "race_date,course_code,race_no,race_status,race_cancel_code,trifecta,trifecta_payout";
export const ENTRY_COLUMNS = "race_date,course_code,race_no,boat_no,racer_registration_no,actual_course,arrival_order,gender_code";
export const GENDER_COLUMNS = "racer_id,racer_gender";

const PAGE = 1000;
// A guard against reading the whole history through the API in one function call (about 7 entries rows per race).
export const MAX_ROWS = 150000;

export function readOnly(client) {
  return { from: table => ({ select: (columns, options) => client.from(table).select(columns, options) }) };
}

async function readAll(build, label) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await build().range(offset, offset + PAGE - 1);
    if (error) throw Object.assign(new Error(`${label}を読み込めませんでした。`), { status: 502 });
    rows.push(...(data || []));
    if (rows.length > MAX_ROWS) throw Object.assign(new Error(`${label}が多すぎます。集計期間か対象の場を絞ってください。`), { status: 413 });
    if (!data || data.length < PAGE) return rows;
  }
}

// period: { from, to } (YYYY-MM-DD, JST race dates). courseCode: optional stadium.
export async function readRaceRows(client, { period, courseCode }) {
  const db = readOnly(client);
  const scoped = (table, columns) => () => {
    let q = db.from(table).select(columns).gte("race_date", period.from).lte("race_date", period.to);
    if (courseCode !== undefined && courseCode !== null) q = q.eq("course_code", courseCode);
    return q.order("race_date").order("course_code").order("race_no");
  };
  const [results, events, entries, genders] = await Promise.all([
    readAll(scoped("bs_race_results", RESULT_COLUMNS), "レース結果"),
    readAll(scoped("bs_race_events", EVENT_COLUMNS), "レース情報"),
    readAll(() => scoped("bs_race_entries", ENTRY_COLUMNS)().order("boat_no"), "出走表"),
    readAll(() => db.from("racer_gender_master").select(GENDER_COLUMNS).order("racer_id"), "選手の性別マスタ"),
  ]);
  return { results, events, entries, genders };
}
