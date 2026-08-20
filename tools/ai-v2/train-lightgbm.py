#!/usr/bin/env python3
import json
import os
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local", override=False)
load_dotenv(ROOT / ".env", override=False)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SERVICE_KEY:
    raise SystemExit("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

OUT = Path(__file__).resolve().parent / "artifacts"
OUT.mkdir(parents=True, exist_ok=True)

TRAIN_END = pd.Timestamp("2026-05-31")
CAL_START = pd.Timestamp("2026-06-01")
CAL_END = pd.Timestamp("2026-07-31")
TEST_START = pd.Timestamp("2026-08-01")

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

# Historical coverage is too sparse for these in v1:
# average_st, relative_st, st_rank_in_race, course1_average_st, course1_top2_rate, course1_race_count

SELECT_COLUMNS = sorted(set([
    "race_date", "course_code", "race_no", "boat_no", "data_timing",
    "is_female_race", "race_day_no",
    "is_first", "is_second", "is_third", "ichika_target", "hatsune_target", "kiina_target",
] + BASE_FEATURES + EXHIBITION_FEATURES))

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Accept": "application/json",
}


def fetch_all(timing: str) -> pd.DataFrame:
    rows = []
    offset = 0
    page = 1000
    endpoint = f"{SUPABASE_URL.rstrip('/')}/rest/v1/ai_v2_training_rows"
    params = {
        "select": ",".join(SELECT_COLUMNS),
        "data_timing": f"eq.{timing}",
        "order": "race_date.asc,course_code.asc,race_no.asc,boat_no.asc",
        "limit": str(page),
    }
    while True:
        params["offset"] = str(offset)
        r = requests.get(endpoint, headers=HEADERS, params=params, timeout=60)
        r.raise_for_status()
        batch = r.json()
        rows.extend(batch)
        if len(batch) < page:
            break
        offset += page
        if offset % 25000 == 0:
            print(f"[{timing}] fetched {offset:,} rows")
    df = pd.DataFrame(rows)
    if df.empty:
        raise RuntimeError(f"No training rows for timing={timing}")
    df["race_date"] = pd.to_datetime(df["race_date"])
    return df


def clean_features(df: pd.DataFrame, timing: str):
    features = list(BASE_FEATURES)
    if timing == "after_exhibition":
        features += EXHIBITION_FEATURES
    X = df[features].copy()
    X["is_female_race"] = X["is_female_race"].astype("float32")
    for c in X.columns:
        X[c] = pd.to_numeric(X[c], errors="coerce")
    return X, features


def safe_auc(y, p):
    try:
        if len(np.unique(y)) < 2:
            return None
        return float(roc_auc_score(y, p))
    except Exception:
        return None


def metrics(y, p):
    eps = 1e-8
    p = np.clip(np.asarray(p, dtype=float), eps, 1 - eps)
    y = np.asarray(y, dtype=int)
    return {
        "rows": int(len(y)),
        "positive_rate": float(np.mean(y)) if len(y) else None,
        "brier": float(brier_score_loss(y, p)) if len(y) else None,
        "log_loss": float(log_loss(y, p, labels=[0, 1])) if len(y) else None,
        "auc": safe_auc(y, p),
    }


def train_one(df: pd.DataFrame, timing: str, target: str, row_filter=None):
    work = df.copy()
    if row_filter is not None:
        work = work.loc[row_filter(work)].copy()
    work = work.loc[work[target].notna()].copy()
    if work.empty:
        print(f"skip {timing}/{target}: no rows")
        return None

    y = pd.to_numeric(work[target], errors="coerce").astype(int)
    X, features = clean_features(work, timing)

    train_mask = work["race_date"] <= TRAIN_END
    cal_mask = (work["race_date"] >= CAL_START) & (work["race_date"] <= CAL_END)
    test_mask = work["race_date"] >= TEST_START

    X_train, y_train = X.loc[train_mask], y.loc[train_mask]
    X_cal, y_cal = X.loc[cal_mask], y.loc[cal_mask]
    X_test, y_test = X.loc[test_mask], y.loc[test_mask]

    if len(X_train) < 500 or len(np.unique(y_train)) < 2:
        raise RuntimeError(f"Insufficient train data for {timing}/{target}: {len(X_train)}")
    if len(X_cal) < 100 or len(np.unique(y_cal)) < 2:
        raise RuntimeError(f"Insufficient calibration data for {timing}/{target}: {len(X_cal)}")

    pos = max(int(y_train.sum()), 1)
    neg = max(int(len(y_train) - y_train.sum()), 1)
    scale_pos_weight = neg / pos

    model = lgb.LGBMClassifier(
        objective="binary",
        n_estimators=1200,
        learning_rate=0.025,
        num_leaves=31,
        min_child_samples=80,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_alpha=0.2,
        reg_lambda=0.5,
        scale_pos_weight=scale_pos_weight,
        random_state=20260821,
        n_jobs=-1,
        verbosity=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_cal, y_cal)],
        eval_metric="binary_logloss",
        callbacks=[lgb.early_stopping(100, verbose=False)],
    )

    p_cal_raw = model.predict_proba(X_cal)[:, 1]
    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(p_cal_raw, y_cal)

    p_train = calibrator.transform(model.predict_proba(X_train)[:, 1])
    p_cal = calibrator.transform(p_cal_raw)
    p_test = calibrator.transform(model.predict_proba(X_test)[:, 1]) if len(X_test) else np.array([])

    name = f"{target}__{timing}__lgbm_v1"
    model_path = OUT / f"{name}.joblib"
    cal_path = OUT / f"{name}__isotonic.joblib"
    metrics_path = OUT / f"{name}__metrics.json"

    joblib.dump({"model": model, "features": features}, model_path)
    joblib.dump(calibrator, cal_path)

    result = {
        "name": name,
        "target": target,
        "timing": timing,
        "feature_version": "ai-v2-feature-v2",
        "excluded_sparse_features": [
            "average_st", "relative_st", "st_rank_in_race",
            "course1_average_st", "course1_top2_rate", "course1_race_count",
        ],
        "train_window": [str(work.loc[train_mask, "race_date"].min().date()), str(TRAIN_END.date())],
        "calibration_window": [str(CAL_START.date()), str(CAL_END.date())],
        "test_window": [str(TEST_START.date()), str(work["race_date"].max().date())],
        "best_iteration": int(getattr(model, "best_iteration_", 0) or 0),
        "features": features,
        "metrics": {
            "train": metrics(y_train, p_train),
            "calibration": metrics(y_cal, p_cal),
            "test": metrics(y_test, p_test) if len(X_test) else None,
        },
    }
    metrics_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def main():
    all_results = []
    for timing in ["previous_day", "after_exhibition"]:
        df = fetch_all(timing)
        print(f"[{timing}] {len(df):,} rows / {df['race_date'].min().date()}..{df['race_date'].max().date()}")

        for target in ["is_first", "is_second", "is_third"]:
            r = train_one(df, timing, target)
            if r:
                all_results.append(r)

        specs = [
            ("ichika_target", lambda x: x["boat_no"] == 1),
            ("hatsune_target", lambda x: (x["boat_no"] == 1) & (x["is_female_race"] == True)),
            ("kiina_target", lambda x: x["boat_no"] == 5),
        ]
        for target, filt in specs:
            r = train_one(df, timing, target, filt)
            if r:
                all_results.append(r)

    summary = OUT / "training_summary.json"
    summary.write_text(json.dumps(all_results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"saved {len(all_results)} models -> {summary}")


if __name__ == "__main__":
    main()
