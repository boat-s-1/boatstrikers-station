// 事故・異常着（フライング・出遅れ・欠場・失格）の集計。
// bs_race_entries.result_code は着順確定後に全艇分まとめて同期される（完走艇は "01"〜"06"、異常は F/L/K/S 系）。
// 同期前は空なので、空のままのレースが1つでもあれば「未確定」とし、件数を出さない（同期前の 0 件を「事故なし」と誤表示しない）。

import { raceKey } from "./winningTechnique.js";

export const RESULT_CODE_LABELS = {
  F: "フライング",
  L0: "出遅れ",
  L1: "出遅れ（責任外）",
  K0: "欠場",
  K1: "欠場（責任外）",
  S0: "失格",
  S1: "失格（責任外）",
  S2: "他艇を妨害",
};

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

// events：対象レース（中止を除いた確定レース）。entries：同じ日の出走表（boat_no, racer_name, result_code）。
export function summarizeIncidents(events, entries, { cleanName = (x) => String(x || "") } = {}) {
  const byRace = new Map();
  for (const row of entries || []) {
    const key = raceKey(row);
    if (!byRace.has(key)) byRace.set(key, []);
    byRace.get(key).push(row);
  }

  const races = [];
  const unsynced = [];
  for (const event of events || []) {
    const rows = byRace.get(raceKey(event)) || [];
    if (!rows.length || rows.some((row) => !normalizeCode(row.result_code))) {
      unsynced.push({ course_code: event.course_code, race_no: event.race_no });
      continue;
    }
    const items = rows
      .filter((row) => RESULT_CODE_LABELS[normalizeCode(row.result_code)])
      .sort((a, b) => a.boat_no - b.boat_no)
      .map((row) => {
        const code = normalizeCode(row.result_code);
        return { boat_no: row.boat_no, racer_name: cleanName(row.racer_name), code, label: RESULT_CODE_LABELS[code] };
      });
    if (items.length) {
      races.push({
        course_code: event.course_code,
        venue: event.course_name || `場コード${event.course_code}`,
        race_no: event.race_no,
        items,
      });
    }
  }
  races.sort((a, b) => a.course_code - b.course_code || a.race_no - b.race_no);

  const complete = (events || []).length > 0 && unsynced.length === 0;
  return {
    status: complete ? "complete" : "incomplete",
    races: complete ? races : [],
    race_count: complete ? races.length : null,
    unsynced_race_count: unsynced.length,
    unsynced_races: unsynced.slice(0, 20),
  };
}
