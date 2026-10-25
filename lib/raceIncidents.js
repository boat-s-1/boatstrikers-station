// 事故・異常着の集計。
// bs_race_entries.result_code は着順確定後に全艇分まとめて同期される（完走艇は "01"〜"06"、異常は F/L/K/S 系）。
// 同期前は空なので、空のままのレースが1つでもあれば「未確定」とし、件数を出さない（同期前の 0 件を「事故なし」と誤表示しない）。
// どのレース・どの艇が事故・異常着かは result_code で判定する（件数の数え方は従来どおり）。
// 表記は公式結果の着順欄の記号（finish_place）だけを読み替える。result_code の責任区分（S0/S1 など）は付与元を確かめられないため使わない。

import { raceKey } from "./winningTechnique.js";

// 事故・異常着として数える result_code
export const INCIDENT_RESULT_CODES = new Set(["F", "L0", "L1", "K0", "K1", "S0", "S1", "S2"]);

// 公式着順欄の記号 → 表記（責任の有無は付けない）
export const FINISH_MARK_LABELS = {
  F: "フライング",
  L: "出遅れ",
  転: "転覆",
  落: "落水",
  沈: "沈没",
  エ: "エンスト",
  不: "不完走",
  妨: "妨害",
  欠: "欠場",
  失: "失格",
};

// 公式記号が取れていない艇は推測せずこの表記にする
export const UNKNOWN_MARK_LABEL = "異常着";

export const INCIDENT_NOTE = "※事故・異常着の表記は公式結果の着順欄に基づいています。責任区分を確認できない事象については、失格・責任外の区別を記載していません。";

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

// 着順欄の記号。全角英字は半角に、空白は除く。完走（1〜6）と空は null。
export function normalizeFinishMark(value) {
  const s = String(value ?? "").normalize("NFKC").replace(/\s+/g, "").toUpperCase();
  if (!s || /^[1-6]$/.test(s)) return null;
  return s;
}

export function finishMarkLabel(value) {
  const mark = normalizeFinishMark(value);
  return (mark && FINISH_MARK_LABELS[mark]) || UNKNOWN_MARK_LABEL;
}

// events：対象レース（中止を除いた確定レース）。entries：同じ日の出走表（boat_no, racer_name, result_code, finish_place）。
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
      .filter((row) => INCIDENT_RESULT_CODES.has(normalizeCode(row.result_code)))
      .sort((a, b) => a.boat_no - b.boat_no)
      .map((row) => ({
        boat_no: row.boat_no,
        racer_name: cleanName(row.racer_name),
        code: normalizeCode(row.result_code),
        mark: normalizeFinishMark(row.finish_place),
        label: finishMarkLabel(row.finish_place),
      }));
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
