#!/usr/bin/env python3
"""Offline PR298 guard: isolation DDL must retain the nine catalogued race triggers.

This checks declared DDL against the production read-only inventory; it does
NOT prove runtime parity or authorize applying the isolation SQL to production.
"""
from pathlib import Path
import re

root = Path(__file__).resolve().parent
sql = (root / "SIX-TABLE-ISOLATION-CANDIDATE.sql").read_text()
expected = {
    "bs_race_entries_exhibition_guard": "bs_race_entries",
    "bs_race_entries_set_updated_at": "bs_race_entries",
    "trg_bs_reconcile_bootstrap_entry": "bs_race_entries",
    "trg_bs_reconcile_bootstrap_event_after_entry": "bs_race_entries",
    "trg_bs_track_entry_first_seen": "bs_race_entries",
    "trg_ichika_escape_surge_on_exhibition_update": "bs_race_entries",
    "bs_race_events_set_updated_at": "bs_race_events",
    "trg_settle_theory_recommendations": "bs_race_events",
    "trg_bs_track_result_first_seen": "bs_race_results",
}
pattern = re.compile(
    r"CREATE\s+TRIGGER\s+(\w+)\s+.*?\s+ON\s+(?:public\.)?(\w+)\s+"
    r"FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+(\w+)\s*\(",
    re.IGNORECASE | re.DOTALL,
)
found = {}
for name, table, function in pattern.findall(sql):
    if name in found:
        raise SystemExit(f"FAIL: duplicate trigger definition {name}")
    found[name] = (table, function)
for name, table in expected.items():
    if name not in found:
        raise SystemExit(f"FAIL: missing production race trigger {name}")
    if found[name][0] != table:
        raise SystemExit(f"FAIL: {name} bound to {found[name][0]}, expected {table}")
    function = found[name][1]
    if not re.search(r"CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?"
                     + re.escape(function) + r"\s*\(", sql, re.IGNORECASE):
        raise SystemExit(f"FAIL: {name} references absent function {function}")
if len(found) != 10:
    raise SystemExit(f"FAIL: expected nine race triggers plus one alert trigger, got {len(found)}")
print("PASS: nine production race trigger names, tables and function definitions; one alert trigger")
