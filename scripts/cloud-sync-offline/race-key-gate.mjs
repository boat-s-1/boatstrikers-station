// Offline-only race-key gate. No imports for network or database access.
export function inspectRaceKeys(rows, expectedDate) {
  const issues = [];
  const seen = new Set();
  if (!Array.isArray(rows)) return { status: "HOLD", issues: ["rows_not_array"], count: 0 };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedDate || "")) return { status: "HOLD", issues: ["invalid_expected_date"], count: 0 };
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) { issues.push("invalid_row"); continue; }
    const { race_date, course_code, race_no } = row;
    if (race_date !== expectedDate || !Number.isInteger(course_code) || course_code < 1 || course_code > 24 || !Number.isInteger(race_no) || race_no < 1 || race_no > 12) {
      issues.push("invalid_key");
      continue;
    }
    const key = `${race_date}/${course_code}/${race_no}`;
    if (seen.has(key)) issues.push("duplicate_key");
    seen.add(key);
  }
  return { status: issues.length ? "HOLD" : "PASS_OFFLINE_ONLY", issues, count: seen.size };
}
