#!/usr/bin/env python3
import os
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
load_dotenv(ROOT / ".env.local", override=False)
load_dotenv(ROOT / ".env", override=False)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SERVICE_KEY:
    raise SystemExit("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}
JST = timezone(timedelta(hours=9))


def jst_now():
    return datetime.now(JST)


def rpc(name, payload=None):
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/rpc/{name}"
    r = requests.post(url, headers=HEADERS, json=payload or {}, timeout=90)
    r.raise_for_status()
    return r.json()


def run_inference(target_date):
    cmd = [
        sys.executable,
        str(HERE / "infer-daily-selected.py"),
        "--date",
        target_date,
        "--timing",
        "after_exhibition",
        "--cutoff",
        jst_now().isoformat(),
    ]
    print("[BoatStrikers AI v2] running:", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


def main():
    now = jst_now()
    minutes = now.hour * 60 + now.minute
    if minutes < 7 * 60 or minutes > 22 * 60 + 30:
        print("outside live window; skip")
        return 0

    target_date = now.date().isoformat()
    status = rpc("bs_ai_v2_after_exhibition_trigger_status", {"p_race_date": target_date})
    print("trigger status:", status)

    if not status or not status.get("needs_inference"):
        print("no new exhibition data; skip")
        return 0

    if int(status.get("complete_races") or 0) <= 0:
        print("no complete exhibition races; skip")
        return 0

    run_inference(target_date)

    published = rpc(
        "bs_publish_ai_v2_predictions",
        {"p_race_date": target_date, "p_timing": "after_exhibition"},
    )
    print("published:", published)
    print("after-exhibition AI and public race prediction updated")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(f"inference failed: exit={exc.returncode}", file=sys.stderr)
        raise
    except Exception as exc:
        print(f"live trigger failed: {exc}", file=sys.stderr)
        raise
