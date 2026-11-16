#!/usr/bin/env python3
"""Create a disposable noon-JST copy of the Cron SQL for deterministic CI.
Never modify the tracked candidate or deploy the generated fixture SQL.
"""
from pathlib import Path
import sys

src = Path("scripts/cloud-sync-offline/openapi-atomic-cron-caller.candidate.sql").read_text()
clock = "(((now() AT TIME ZONE 'Asia/Tokyo')::date + time '12:00') AT TIME ZONE 'Asia/Tokyo')"
count = src.count("now()")
if count != 3:
    raise SystemExit(f"Unexpected candidate now() count: {count}; refuse fixture rewrite")
dst = src.replace("now()", clock, 2)
if dst == src or dst.count(clock) != 2 or not dst.endswith(src[src.rfind('now()')-100:].replace('now()', 'now()')):
    raise SystemExit("Midday fixture clock injection failed")
Path("/tmp/pr298-openapi-atomic-cron-midday.sql").write_text(dst)
print("Generated /tmp/pr298-openapi-atomic-cron-midday.sql (CI-only; clock=12:00 JST)")
