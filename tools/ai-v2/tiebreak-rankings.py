#!/usr/bin/env python3
import argparse
import os
from datetime import date
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
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

BUNDLE_VERSION = "ai-v2-shadow-selected-v1"
RANKING_TYPES = {
    "ichika_escape_best10": {"boat_no": 1, "inverse": False},
    "hatsune_dominant_best3": {"boat_no": 1, "inverse": False},
    "hatsune_risky_best3": {"boat_no": 1, "inverse": True},
    "kiina_boat5_best5": {"boat_no": 5, "inverse": False},
}


def get(table, params):
    r = requests.get(f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}", headers=HEADERS, params=params, timeout=60)
    r.raise_for_status()
    return r.json()


def delete(table, params):
    h = dict(HEADERS)
    h["Prefer"] = "return=minimal"
    r = requests.delete(f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}", headers=h, params=params, timeout=60)
    r.raise_for_status()


def post(table, rows, on_conflict=None):
    if not rows:
        return
    params = {"on_conflict": on_conflict} if on_conflict else None
    h = dict(HEADERS)
    h["Prefer"] = "resolution=merge-duplicates,return=minimal" if on_conflict else "return=minimal"
    r = requests.post(f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}", headers=h, params=params, json=rows, timeout=60)
    r.raise_for_status()


def raw_score(row):
    metrics = row.get("metrics") or {}
    value = metrics.get("raw_ranking_score")
    return float(value) if value is not None else float("-inf")


def main():
    ap = argparse.ArgumentParser(description="Tie-break BoatStrikers AI v2 daily specialist rankings")
    ap.add_argument("--date", default=str(date.today()))
    ap.add_argument("--timing", choices=["previous_day", "after_exhibition"], default="previous_day")
    args = ap.parse_args()

    rankings = get("ai_v2_daily_rankings", {
        "select": "ranking_date,character_code,ranking_type,rank_no,course_code,race_no,probability,model_version,summary,metrics,data_timing,selected_for_social,selected_for_home",
        "ranking_date": f"eq.{args.date}",
        "data_timing": f"eq.{args.timing}",
        "ranking_type": "in.(ichika_escape_best10,hatsune_dominant_best3,hatsune_risky_best3,kiina_boat5_best5)",
        "order": "ranking_type.asc,rank_no.asc",
        "limit": "100",
    })

    predictions = get("ai_v2_predictions", {
        "select": "course_code,race_no,boat_no,first_probability",
        "race_date": f"eq.{args.date}",
        "data_timing": f"eq.{args.timing}",
        "model_version": f"eq.{BUNDLE_VERSION}",
        "boat_no": "in.(1,5)",
        "limit": "1000",
    })
    first_map = {(int(r["course_code"]), int(r["race_no"]), int(r["boat_no"])): float(r["first_probability"]) for r in predictions if r.get("first_probability") is not None}

    rebuilt = []
    for ranking_type, cfg in RANKING_TYPES.items():
        rows = [r for r in rankings if r["ranking_type"] == ranking_type]
        boat_no = cfg["boat_no"]
        inverse = cfg["inverse"]

        def key(r):
            raw = raw_score(r)
            common = first_map.get((int(r["course_code"]), int(r["race_no"]), boat_no), float("-inf"))
            if inverse:
                return (raw, common, int(r["course_code"]), int(r["race_no"]))
            return (-raw, -common, int(r["course_code"]), int(r["race_no"]))

        rows.sort(key=key)
        for rank_no, r in enumerate(rows, 1):
            metrics = dict(r.get("metrics") or {})
            common = first_map.get((int(r["course_code"]), int(r["race_no"]), boat_no))
            metrics["tiebreak_common_first_probability"] = common
            metrics["ranking_rule"] = "specialist_raw_then_common_first"
            rebuilt.append({
                "ranking_date": r["ranking_date"],
                "character_code": r["character_code"],
                "ranking_type": r["ranking_type"],
                "rank_no": rank_no,
                "course_code": int(r["course_code"]),
                "race_no": int(r["race_no"]),
                "probability": float(r["probability"]),
                "model_version": r["model_version"],
                "summary": r.get("summary"),
                "metrics": metrics,
                "data_timing": r["data_timing"],
                "selected_for_social": bool(r.get("selected_for_social", False)),
                "selected_for_home": bool(r.get("selected_for_home", False)),
            })

    for ranking_type in RANKING_TYPES:
        delete("ai_v2_daily_rankings", {
            "ranking_date": f"eq.{args.date}",
            "data_timing": f"eq.{args.timing}",
            "ranking_type": f"eq.{ranking_type}",
        })
    post("ai_v2_daily_rankings", rebuilt, "ranking_date,data_timing,ranking_type,rank_no")

    print(f"tiebreak rebuilt rankings={len(rebuilt)} for {args.date} / {args.timing}")
    for r in rebuilt:
        m = r["metrics"]
        print(
            f"{r['ranking_type']} #{r['rank_no']} course={r['course_code']} race={r['race_no']} "
            f"display={r['probability']:.4f} raw={float(m.get('raw_ranking_score', 0)):.6f} "
            f"common1={float(m.get('tiebreak_common_first_probability') or 0):.6f}"
        )


if __name__ == "__main__":
    main()
