#!/usr/bin/env python3
import argparse
import json
import os
from datetime import date, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local", override=False)
load_dotenv(ROOT / ".env", override=False)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SERVICE_KEY:
    raise SystemExit("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

ARTIFACT_DIR = Path(__file__).resolve().parent / "artifacts"
FEATURE_VERSION = "ai-v2-feature-v2"
BUNDLE_VERSION = "ai-v2-shadow-bundle-lgbm-v1"

BASE_FEATURES = [
    "boat_no", "race_day_no", "is_female_race",
    "national_win_rate", "national_2_rate", "local_win_rate", "local_2_rate",
    "motor_2_rate", "boat_2_rate", "flying_count", "late_count",
    "relative_national", "relative_local", "relative_motor",
    "national_rank_in_race", "local_rank_in_race", "motor_rank_in_race",
]
EXHIBITION_FEATURES = [
    "exhibition_time", "exhibition_rank", "exhibition_st", "exhibition_course",
    "half_lap_time", "lap_time", "turn_time", "straight_time", "tilt",
    "wind_speed", "wave_height",
]

MODEL_NAMES = {
    "is_first": "is_first__{timing}__lgbm_v1",
    "is_second": "is_second__{timing}__lgbm_v1",
    "is_third": "is_third__{timing}__lgbm_v1",
    "ichika_target": "ichika_target__{timing}__lgbm_v1",
    "hatsune_target": "hatsune_target__{timing}__lgbm_v1",
    "kiina_target": "kiina_target__{timing}__lgbm_v1",
}

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Accept": "application/json",
    "Content-Type": "application/json",
}


def api_get(table, params):
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
    r = requests.get(url, headers=HEADERS, params=params, timeout=60)
    r.raise_for_status()
    return r.json()


def api_post(table, rows, on_conflict=None):
    if not rows:
        return
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
    params = {"on_conflict": on_conflict} if on_conflict else None
    headers = dict(HEADERS)
    headers["Prefer"] = "resolution=merge-duplicates,return=minimal" if on_conflict else "return=minimal"
    for start in range(0, len(rows), 300):
        r = requests.post(url, headers=headers, params=params, json=rows[start:start + 300], timeout=90)
        r.raise_for_status()


def api_delete(table, params):
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{table}"
    headers = dict(HEADERS)
    headers["Prefer"] = "return=minimal"
    r = requests.delete(url, headers=headers, params=params, timeout=60)
    r.raise_for_status()


def first_present(df, names):
    out = pd.Series(np.nan, index=df.index, dtype="object")
    for name in names:
        if name in df.columns:
            out = out.where(out.notna(), df[name])
    return out


def normalize_gender(row):
    gender = str(row.get("gender") or "").strip().upper()
    code = str(row.get("gender_code") or "").strip()
    sex = row.get("sex_code")
    if gender in ("F", "FEMALE", "女", "女子") or code == "2" or sex == 2:
        return "F"
    if gender in ("M", "MALE", "男", "男子") or code == "1" or sex == 1:
        return "M"
    return None


def fetch_source(target_date):
    entry_cols = [
        "race_date","course_code","race_no","boat_no","racer_registration_no","racer_class","class",
        "gender","gender_code","sex_code","national_win_rate","national_top2_rate","national_2_rate",
        "local_win_rate","local_top2_rate","local_2_rate","motor_top2_rate","motor_2_rate","motor_second_rate",
        "race_boat_top2_rate","boat_2_rate","race_boat_second_rate","flying_count","late_count",
        "official_exhibition_time","exhibition_time","exhibition_time_rank","start_exhibition_rank",
        "official_exhibition_st","exhibition_st","official_exhibition_course","exhibition_course",
        "official_half_lap","half_lap_time","official_lap","lap_time","official_turn","turn_time",
        "official_straight","straight_time","official_tilt","tilt"
    ]
    event_cols = ["race_date","course_code","race_no","race_day_no","wind_speed","wave_height"]
    entries = api_get("bs_race_entries", {
        "select": ",".join(entry_cols),
        "race_date": f"eq.{target_date}",
        "order": "course_code.asc,race_no.asc,boat_no.asc",
        "limit": "5000",
    })
    events = api_get("bs_race_events", {
        "select": ",".join(event_cols),
        "race_date": f"eq.{target_date}",
        "order": "course_code.asc,race_no.asc",
        "limit": "1000",
    })
    if not entries:
        raise RuntimeError(f"No bs_race_entries for {target_date}")
    e = pd.DataFrame(entries)
    ev = pd.DataFrame(events)
    if not ev.empty:
        e = e.merge(ev, on=["race_date","course_code","race_no"], how="left")
    else:
        e["race_day_no"] = np.nan
        e["wind_speed"] = np.nan
        e["wave_height"] = np.nan
    return e


def prepare_features(raw, timing):
    df = raw.copy()
    for c in ["course_code","race_no","boat_no"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    df["national_2_rate"] = first_present(df, ["national_top2_rate","national_2_rate"])
    df["local_2_rate"] = first_present(df, ["local_top2_rate","local_2_rate"])
    df["motor_2_rate"] = first_present(df, ["motor_top2_rate","motor_2_rate","motor_second_rate"])
    df["boat_2_rate"] = first_present(df, ["race_boat_top2_rate","boat_2_rate","race_boat_second_rate"])
    df["exhibition_time"] = first_present(df, ["official_exhibition_time","exhibition_time"])
    df["exhibition_rank"] = first_present(df, ["exhibition_time_rank","start_exhibition_rank"])
    df["exhibition_st"] = first_present(df, ["official_exhibition_st","exhibition_st"])
    df["exhibition_course"] = first_present(df, ["official_exhibition_course","exhibition_course"])
    df["half_lap_time"] = first_present(df, ["official_half_lap","half_lap_time"])
    df["lap_time"] = first_present(df, ["official_lap","lap_time"])
    df["turn_time"] = first_present(df, ["official_turn","turn_time"])
    df["straight_time"] = first_present(df, ["official_straight","straight_time"])
    df["tilt"] = first_present(df, ["official_tilt","tilt"])

    df["normalized_gender"] = df.apply(normalize_gender, axis=1)
    keys = ["race_date","course_code","race_no"]
    race_counts = df.groupby(keys)["boat_no"].transform("count")
    df = df[race_counts == 6].copy()
    female_counts = df.groupby(keys)["normalized_gender"].transform(lambda s: int((s == "F").sum()))
    known_counts = df.groupby(keys)["normalized_gender"].transform(lambda s: int(s.notna().sum()))
    df["is_female_race"] = (female_counts == 6) & (known_counts == 6)

    if timing == "after_exhibition":
        exhibition_counts = df.groupby(keys)["exhibition_time"].transform(lambda s: int(pd.to_numeric(s, errors="coerce").notna().sum()))
        df = df[exhibition_counts == 6].copy()
        if df.empty:
            raise RuntimeError("No races have six exhibition times yet")

    numeric = [
        "race_day_no","national_win_rate","national_2_rate","local_win_rate","local_2_rate",
        "motor_2_rate","boat_2_rate","flying_count","late_count",
        "exhibition_time","exhibition_rank","exhibition_st","exhibition_course","half_lap_time",
        "lap_time","turn_time","straight_time","tilt","wind_speed","wave_height"
    ]
    for c in numeric:
        if c not in df.columns:
            df[c] = np.nan
        df[c] = pd.to_numeric(df[c], errors="coerce")

    grp = df.groupby(keys, dropna=False)
    df["relative_national"] = df["national_win_rate"] - grp["national_win_rate"].transform("mean")
    df["relative_local"] = df["local_win_rate"] - grp["local_win_rate"].transform("mean")
    df["relative_motor"] = df["motor_2_rate"] - grp["motor_2_rate"].transform("mean")
    df["national_rank_in_race"] = grp["national_win_rate"].rank(method="min", ascending=False, na_option="bottom")
    df["local_rank_in_race"] = grp["local_win_rate"].rank(method="min", ascending=False, na_option="bottom")
    df["motor_rank_in_race"] = grp["motor_2_rate"].rank(method="min", ascending=False, na_option="bottom")
    return df.sort_values(keys + ["boat_no"]).reset_index(drop=True)


def load_head(target, timing):
    version = MODEL_NAMES[target].format(timing=timing)
    model_path = ARTIFACT_DIR / f"{version}.joblib"
    cal_path = ARTIFACT_DIR / f"{version}__isotonic.joblib"
    if not model_path.exists() or not cal_path.exists():
        raise FileNotFoundError(f"Missing model artifact: {model_path} / {cal_path}")
    packed = joblib.load(model_path)
    calibrator = joblib.load(cal_path)
    return version, packed["model"], packed["features"], calibrator


def predict_head(df, target, timing, mask=None):
    version, model, features, calibrator = load_head(target, timing)
    result = pd.Series(np.nan, index=df.index, dtype="float64")
    idx = df.index if mask is None else df.index[mask]
    if len(idx):
        X = df.loc[idx, features].copy()
        if "is_female_race" in X.columns:
            X["is_female_race"] = X["is_female_race"].astype("float32")
        for c in X.columns:
            X[c] = pd.to_numeric(X[c], errors="coerce")
        raw_p = model.predict_proba(X)[:, 1]
        result.loc[idx] = calibrator.transform(raw_p)
    return version, result


def json_safe(value):
    if value is None:
        return None
    if isinstance(value, (np.floating, float)):
        return None if np.isnan(value) else float(value)
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    return value


def write_predictions(df, target_date, timing, cutoff):
    versions = {}
    versions["first"], df["first_probability"] = predict_head(df, "is_first", timing)
    versions["second"], df["second_probability"] = predict_head(df, "is_second", timing)
    versions["third"], df["third_probability"] = predict_head(df, "is_third", timing)
    versions["ichika"], df["ichika_probability"] = predict_head(df, "ichika_target", timing, df["boat_no"] == 1)
    versions["hatsune"], df["hatsune_probability"] = predict_head(df, "hatsune_target", timing, (df["boat_no"] == 1) & df["is_female_race"])
    versions["kiina"], df["kiina_probability"] = predict_head(df, "kiina_target", timing, df["boat_no"] == 5)

    used_features = BASE_FEATURES + (EXHIBITION_FEATURES if timing == "after_exhibition" else [])
    rows = []
    for _, r in df.iterrows():
        snapshot = {c: json_safe(r.get(c)) for c in used_features}
        rows.append({
            "race_date": target_date,
            "course_code": int(r["course_code"]),
            "race_no": int(r["race_no"]),
            "boat_no": int(r["boat_no"]),
            "data_timing": timing,
            "model_version": BUNDLE_VERSION,
            "model_versions": versions,
            "feature_version": FEATURE_VERSION,
            "first_probability": json_safe(r["first_probability"]),
            "second_probability": json_safe(r["second_probability"]),
            "third_probability": json_safe(r["third_probability"]),
            "ichika_probability": json_safe(r["ichika_probability"]),
            "hatsune_probability": json_safe(r["hatsune_probability"]),
            "kiina_probability": json_safe(r["kiina_probability"]),
            "feature_snapshot": snapshot,
            "explanation": {"mode": "shadow", "calibration": "isotonic"},
            "data_cutoff_at": cutoff,
            "predicted_at": datetime.now().astimezone().isoformat(),
        })
    api_post(
        "ai_v2_predictions",
        rows,
        "race_date,course_code,race_no,boat_no,data_timing,model_version",
    )
    return versions


def make_rankings(df, target_date, timing, versions):
    ranking_types = ["ichika_escape_best10","hatsune_dominant_best3","hatsune_risky_best3","kiina_boat5_best5"]
    for rt in ranking_types:
        api_delete("ai_v2_daily_rankings", {
            "ranking_date": f"eq.{target_date}",
            "data_timing": f"eq.{timing}",
            "ranking_type": f"eq.{rt}",
        })

    out = []
    def add(frame, character, ranking_type, prob_col, limit, model_version, inverse=False):
        data = frame.dropna(subset=[prob_col]).copy()
        if inverse:
            data["ranking_probability"] = 1.0 - data[prob_col]
            data = data.sort_values("ranking_probability", ascending=False)
        else:
            data["ranking_probability"] = data[prob_col]
            data = data.sort_values("ranking_probability", ascending=False)
        for rank_no, (_, r) in enumerate(data.head(limit).iterrows(), start=1):
            p = float(r["ranking_probability"])
            summary = f"AI v2 shadow {p*100:.1f}%"
            metrics = {
                "bundle_version": BUNDLE_VERSION,
                "is_female_race": bool(r["is_female_race"]),
                "boat1_win_probability": json_safe(r.get("hatsune_probability")),
                "first_probability": json_safe(r.get("first_probability")),
                "shadow": True,
            }
            out.append({
                "ranking_date": target_date,
                "character_code": character,
                "ranking_type": ranking_type,
                "rank_no": rank_no,
                "course_code": int(r["course_code"]),
                "race_no": int(r["race_no"]),
                "probability": p,
                "model_version": model_version,
                "summary": summary,
                "metrics": metrics,
                "data_timing": timing,
            })

    boat1 = df[df["boat_no"] == 1]
    add(boat1, "ichika", "ichika_escape_best10", "ichika_probability", 10, versions["ichika"])
    female_boat1 = boat1[boat1["is_female_race"]]
    add(female_boat1, "hatsune", "hatsune_dominant_best3", "hatsune_probability", 3, versions["hatsune"])
    add(female_boat1, "hatsune", "hatsune_risky_best3", "hatsune_probability", 3, versions["hatsune"], inverse=True)
    boat5 = df[df["boat_no"] == 5]
    add(boat5, "kiina", "kiina_boat5_best5", "kiina_probability", 5, versions["kiina"])

    api_post("ai_v2_daily_rankings", out, "ranking_date,data_timing,ranking_type,rank_no")
    return out


def main():
    parser = argparse.ArgumentParser(description="BoatStrikers AI v2 daily shadow inference")
    parser.add_argument("--date", default=str(date.today()), help="Race date YYYY-MM-DD (default: today)")
    parser.add_argument("--timing", choices=["previous_day","after_exhibition"], default="previous_day")
    parser.add_argument("--cutoff", default=None, help="Audit cutoff timestamp; default=current local time")
    args = parser.parse_args()

    cutoff = args.cutoff or datetime.now().astimezone().isoformat()
    raw = fetch_source(args.date)
    df = prepare_features(raw, args.timing)
    races = df[["course_code","race_no"]].drop_duplicates().shape[0]
    print(f"[{args.timing}] source: {len(df):,} rows / {races:,} races for {args.date}")
    versions = write_predictions(df, args.date, args.timing, cutoff)
    rankings = make_rankings(df, args.date, args.timing, versions)
    print(f"saved predictions={len(df):,}, rankings={len(rankings)}")
    for row in rankings:
        print(f"{row['ranking_type']} #{row['rank_no']} course={row['course_code']} race={row['race_no']} p={row['probability']:.4f}")


if __name__ == "__main__":
    main()
