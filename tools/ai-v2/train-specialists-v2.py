#!/usr/bin/env python3
import json
import math
import os
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv
from sklearn.linear_model import LogisticRegression
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

BASE = [
    "national_win_rate","national_2_rate","local_win_rate","local_2_rate",
    "motor_2_rate","boat_2_rate","flying_count","late_count",
    "relative_national","relative_local","relative_motor",
    "national_rank_in_race","local_rank_in_race","motor_rank_in_race",
]
EXH = [
    "exhibition_time","exhibition_rank","exhibition_st","exhibition_course",
    "half_lap_time","lap_time","turn_time","straight_time","tilt","wind_speed","wave_height",
]
SELECT = sorted(set([
    "race_date","course_code","race_no","boat_no","data_timing","is_female_race","race_day_no",
    "ichika_target","hatsune_target","kiina_target",
] + BASE + EXH))

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Accept": "application/json",
}


def fetch_all(timing):
    rows, offset, page = [], 0, 1000
    endpoint = f"{SUPABASE_URL.rstrip('/')}/rest/v1/ai_v2_training_rows"
    params = {
        "select": ",".join(SELECT),
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
        raise RuntimeError(f"No rows for {timing}")
    df["race_date"] = pd.to_datetime(df["race_date"])
    for c in ["course_code","race_no","boat_no","race_day_no"] + BASE + EXH:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def add_race_features(df, target_boat):
    keys = ["race_date","course_code","race_no"]
    g = df.groupby(keys, dropna=False)
    target = df[df["boat_no"] == target_boat].copy()
    target = target.rename(columns={c: f"own_{c}" for c in BASE + EXH if c in target.columns})

    numeric_core = ["national_win_rate","national_2_rate","local_win_rate","local_2_rate","motor_2_rate","boat_2_rate"]
    race_mean = g[numeric_core].mean().rename(columns={c: f"race_mean_{c}" for c in numeric_core}).reset_index()
    race_max = g[numeric_core].max().rename(columns={c: f"race_max_{c}" for c in numeric_core}).reset_index()

    boat1 = df[df["boat_no"] == 1][keys + numeric_core].rename(columns={c: f"boat1_{c}" for c in numeric_core})
    boat2 = df[df["boat_no"] == 2][keys + numeric_core].rename(columns={c: f"boat2_{c}" for c in numeric_core})
    boat5 = df[df["boat_no"] == 5][keys + numeric_core].rename(columns={c: f"boat5_{c}" for c in numeric_core})

    out = target.merge(race_mean, on=keys, how="left").merge(race_max, on=keys, how="left")
    out = out.merge(boat1, on=keys, how="left").merge(boat2, on=keys, how="left").merge(boat5, on=keys, how="left")

    for c in numeric_core:
        own = f"own_{c}"
        if own in out.columns:
            out[f"diff_vs_mean_{c}"] = out[own] - out[f"race_mean_{c}"]
            out[f"diff_vs_max_{c}"] = out[own] - out[f"race_max_{c}"]
            out[f"diff_vs_boat1_{c}"] = out[own] - out[f"boat1_{c}"]
            out[f"diff_vs_boat2_{c}"] = out[own] - out[f"boat2_{c}"]
            out[f"diff_vs_boat5_{c}"] = out[own] - out[f"boat5_{c}"]

    inner = df[df["boat_no"].between(1,4)].groupby(keys)[numeric_core].mean().rename(columns={c: f"inner14_mean_{c}" for c in numeric_core}).reset_index()
    out = out.merge(inner, on=keys, how="left")
    for c in numeric_core:
        own = f"own_{c}"
        if own in out.columns:
            out[f"diff_vs_inner14_{c}"] = out[own] - out[f"inner14_mean_{c}"]

    return out


def feature_columns(df, timing):
    excluded = {
        "race_date","course_code","race_no","boat_no","data_timing","ichika_target","hatsune_target","kiina_target",
        "is_female_race"
    }
    cols = []
    for c in df.columns:
        if c in excluded:
            continue
        if timing == "previous_day" and any(x in c for x in EXH):
            continue
        if c.startswith("own_") or c.startswith("race_") or c.startswith("boat1_") or c.startswith("boat2_") or c.startswith("boat5_") or c.startswith("diff_") or c.startswith("inner14_") or c == "race_day_no":
            cols.append(c)
    return cols


def metrics(y, p):
    p = np.clip(np.asarray(p, dtype=float), 1e-8, 1 - 1e-8)
    y = np.asarray(y, dtype=int)
    return {
        "rows": int(len(y)),
        "positive_rate": float(np.mean(y)),
        "brier": float(brier_score_loss(y, p)),
        "log_loss": float(log_loss(y, p, labels=[0,1])),
        "auc": float(roc_auc_score(y, p)) if len(np.unique(y)) > 1 else None,
    }


def train_one(df, timing, target, boat_no, female_only=False):
    work = add_race_features(df, boat_no)
    if female_only:
        work = work[work["is_female_race"] == True].copy()
    work = work[work[target].notna()].copy()
    y = pd.to_numeric(work[target], errors="coerce").astype(int)
    features = feature_columns(work, timing)
    X = work[features].copy()
    for c in X.columns:
        X[c] = pd.to_numeric(X[c], errors="coerce")

    train_mask = work["race_date"] <= TRAIN_END
    cal_mask = (work["race_date"] >= CAL_START) & (work["race_date"] <= CAL_END)
    test_mask = work["race_date"] >= TEST_START

    X_train, y_train = X.loc[train_mask], y.loc[train_mask]
    X_cal, y_cal = X.loc[cal_mask], y.loc[cal_mask]
    X_test, y_test = X.loc[test_mask], y.loc[test_mask]

    pos = max(int(y_train.sum()), 1)
    neg = max(int(len(y_train) - y_train.sum()), 1)
    model = lgb.LGBMClassifier(
        objective="binary",
        n_estimators=1500,
        learning_rate=0.02,
        num_leaves=23,
        min_child_samples=60,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_alpha=0.3,
        reg_lambda=0.8,
        scale_pos_weight=neg/pos,
        random_state=20260821,
        n_jobs=-1,
        verbosity=-1,
    )
    model.fit(X_train, y_train, eval_X=X_cal, eval_y=y_cal, eval_metric="binary_logloss", callbacks=[lgb.early_stopping(120, verbose=False)])

    # Platt calibration: continuous and monotonic, avoids isotonic plateaus in daily rankings.
    p_cal_raw = np.clip(model.predict_proba(X_cal)[:,1], 1e-6, 1-1e-6)
    z_cal = np.log(p_cal_raw / (1-p_cal_raw)).reshape(-1,1)
    calibrator = LogisticRegression(solver="lbfgs")
    calibrator.fit(z_cal, y_cal)

    def calibrated(X_):
        p = np.clip(model.predict_proba(X_)[:,1], 1e-6, 1-1e-6)
        z = np.log(p/(1-p)).reshape(-1,1)
        return calibrator.predict_proba(z)[:,1]

    name = f"{target}__{timing}__lgbm_v2"
    joblib.dump({"model": model, "features": features}, OUT / f"{name}.joblib")
    joblib.dump(calibrator, OUT / f"{name}__platt.joblib")

    result = {
        "name": name,
        "target": target,
        "timing": timing,
        "boat_no": boat_no,
        "feature_version": "ai-v2-specialist-v2",
        "calibration": "platt",
        "best_iteration": int(getattr(model, "best_iteration_", 0) or 0),
        "feature_count": len(features),
        "metrics": {
            "train": metrics(y_train, calibrated(X_train)),
            "calibration": metrics(y_cal, calibrated(X_cal)),
            "test": metrics(y_test, calibrated(X_test)),
        }
    }
    (OUT / f"{name}__metrics.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return result


def main():
    results = []
    for timing in ["previous_day","after_exhibition"]:
        df = fetch_all(timing)
        print(f"[{timing}] {len(df):,} rows")
        results.append(train_one(df, timing, "ichika_target", 1, False))
        results.append(train_one(df, timing, "hatsune_target", 1, True))
        results.append(train_one(df, timing, "kiina_target", 5, False))
    (OUT / "specialists_v2_summary.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"saved {len(results)} specialist v2 models")

if __name__ == "__main__":
    main()
