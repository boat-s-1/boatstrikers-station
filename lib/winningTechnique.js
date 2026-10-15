// 決まり手は bs_race_results の確定結果の文字列だけを使う。
// bs_race_events.winning_technique_code は書き込み元（公式API / Windows同期）で番号の割り当てが違うため、解釈しない。

export const WINNING_TECHNIQUES = ["逃げ", "差し", "まくり", "まくり差し", "抜き", "恵まれ"];

const TECHNIQUE_SET = new Set(WINNING_TECHNIQUES);

export function raceKey(row) {
  return `${row.course_code}-${row.race_no}`;
}

export function normalizeTechnique(value) {
  const s = String(value ?? "").replace(/[\s　]+/g, "");
  return TECHNIQUE_SET.has(s) ? s : null;
}

export function isConfirmedResult(row) {
  return row?.result_status === "confirmed" && (row.race_status == null || row.race_status === "finished");
}

// bs_race_results の行から「レース → 決まり手」の対応を作る。確定・完走でない行と、決まり手が読めない行は入れない。
export function techniqueMapFromResults(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (!isConfirmedResult(row)) continue;
    const label = normalizeTechnique(row.winning_technique) || normalizeTechnique(row.winning_method);
    if (label) map.set(raceKey(row), label);
  }
  return map;
}

// 対象レースすべての決まり手がそろったときだけ件数を確定値として返す。
// 1件でも欠けていれば status は "incomplete" で、escape_wins / counts は null（誤った件数を出さない）。
export function summarizeTechniques(events, techniqueMap) {
  const counts = Object.fromEntries(WINNING_TECHNIQUES.map((label) => [label, 0]));
  const missing = [];
  for (const event of events || []) {
    const label = techniqueMap.get(raceKey(event));
    if (label) counts[label] += 1;
    else missing.push({ course_code: event.course_code, race_no: event.race_no });
  }
  const complete = (events || []).length > 0 && missing.length === 0;
  return {
    status: complete ? "complete" : "incomplete",
    race_count: (events || []).length,
    known_race_count: (events || []).length - missing.length,
    missing_races: missing,
    counts: complete ? counts : null,
    escape_wins: complete ? counts["逃げ"] : null,
  };
}

export async function fetchTechniqueMap(client, raceDate) {
  const { data, error } = await client
    .from("bs_race_results")
    .select("course_code,race_no,winning_technique,winning_method,result_status,race_status")
    .eq("race_date", raceDate);
  if (error) throw error;
  return techniqueMapFromResults(data || []);
}
