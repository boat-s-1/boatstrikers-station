// Offline-only six-boat integrity gate. No I/O, DB, or network calls.
export function inspectSixBoatEntries(entries, expectedDate) {
  const issues = [];
  if (!Array.isArray(entries)) return {status:"HOLD",issues:["entries_not_array"],races:0};
  if (entries.length === 0) return {status:"HOLD",issues:["empty_entries"],races:0};
  if (typeof expectedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expectedDate) || Number.isNaN(Date.parse(expectedDate+"T00:00:00Z")) || new Date(expectedDate+"T00:00:00Z").toISOString().slice(0,10)!==expectedDate) return {status:"HOLD",issues:["invalid_expected_date"],races:0};
  const groups = new Map();
  for (const row of entries) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {issues.push("invalid_entry");continue;}
    const {race_date,course_code,race_no,boat_no,racer_registration_no}=row;
    if (race_date!==expectedDate || !Number.isInteger(course_code) || course_code<1 || course_code>24 || !Number.isInteger(race_no) || race_no<1 || race_no>12 || !Number.isInteger(boat_no) || boat_no<1 || boat_no>6 || !/^[0-9]{4}$/.test(String(racer_registration_no??"")) || String(racer_registration_no)==="0000") {issues.push("invalid_entry_key");continue;}
    const key=`${race_date}/${course_code}/${race_no}`;
    if(!groups.has(key)) groups.set(key,{boats:new Set(),registrations:new Set()});
    const {boats,registrations}=groups.get(key);
    if(boats.has(boat_no)) issues.push("duplicate_boat");
    if(registrations.has(String(racer_registration_no))) issues.push("duplicate_registration");
    boats.add(boat_no);
    registrations.add(String(racer_registration_no));
  }
  for(const {boats} of groups.values()) if(boats.size!==6) issues.push("incomplete_race");
  return {status:issues.length?"HOLD":"PASS_OFFLINE_ONLY",issues,races:groups.size};
}
