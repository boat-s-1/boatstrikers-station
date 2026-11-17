#!/usr/bin/env python3
"""PR298: offline repository inventory, no DB or network access.

Prints whether tracked SQL files include direct creation of core race tables.
This is diagnostic only: dynamic SQL, baseline backups and renames require review.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
TABLES = ("bs_race_events", "bs_race_entries", "bs_race_results")
PATTERN = re.compile(r"\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\s*\.\s*)?([a-z_][a-z_0-9]*)\b", re.I)
sql_files = sorted(p for p in ROOT.rglob("*.sql") if ".git" not in p.parts and "node_modules" not in p.parts)
print(f"PR298_REPOSITORY_SQL_FILES={len(sql_files)}")
found = {name: [] for name in TABLES}
mentions = {name: [] for name in TABLES}
for path in sql_files:
    content = path.read_text(encoding="utf-8", errors="replace")
    relative = str(path.relative_to(ROOT))
    created = set(PATTERN.findall(content))
    for name in TABLES:
        if name in content.lower():
            mentions[name].append(relative)
        if name in created:
            found[name].append(relative)
for name in TABLES:
    print(f"PR298_TABLE={name} DIRECT_CREATE_FILES={len(found[name])} MENTION_FILES={len(mentions[name])}")
    for path in found[name]:
        print(f"  DIRECT_CREATE_PATH={path}")
    for path in mentions[name][:12]:
        print(f"  MENTION_SAMPLE={path}")
    if not found[name]:
        print(f"  GAP={name}: no direct CREATE TABLE found in checked SQL files")
print("PR298_INVENTORY_COMPLETE=diagnostic-only; not a migration replay")
