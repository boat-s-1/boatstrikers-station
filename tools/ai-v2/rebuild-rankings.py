#!/usr/bin/env python3
import argparse
import importlib.util
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("infer_daily", HERE / "infer-daily.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def score_head(df, target, timing, mask):
    version, model, features, calibrator = mod.load_head(target, timing)
    raw = pd.Series(np.nan, index=df.index, dtype="float64")
    calibrated = pd.Series(np.nan, index=df.index, dtype="float64")
    idx = df.index[mask]
    if len(idx):
        X = df.loc[idx, features].copy()
        if "is_female_race" in X.columns:
            X["is_female_race"] = X["is_female_race"].astype("float32")
        for c in X.columns:
            X[c] = pd.to_numeric(X[c], errors="coerce")
        p_raw = model.predict_proba(X)[:, 1]
        raw.loc[idx] = p_raw
        calibrated.loc[idx] = calibrator.transform(p_raw)
    return version, raw, calibrated


def rebuild(target_date, timing):
    raw_source = mod.fetch_source(target_date)
    df = mod.prepare_features(raw_source, timing)

    ichika_v, df["ichika_rank_score"], df["ichika_probability"] = score_head(
        df, "ichika_target", timing, df["boat_no"] == 1
    )
    hatsune_v, df["hatsune_rank_score"], df["hatsune_probability"] = score_head(
        df, "hatsune_target", timing, (df["boat_no"] == 1) & df["is_female_race"]
    )
    kiina_v, df["kiina_rank_score"], df["kiina_probability"] = score_head(
        df, "kiina_target", timing, df["boat_no"] == 5
    )

    ranking_types = [
        "ichika_escape_best10",
        "hatsune_dominant_best3",
        "hatsune_risky_best3",
        "kiina_boat5_best5",
    ]
    for rt in ranking_types:
        mod.api_delete("ai_v2_daily_rankings", {
            "ranking_date": f"eq.{target_date}",
            "data_timing": f"eq.{timing}",
            "ranking_type": f"eq.{rt}",
        })

    rows = []

    def add(frame, character, ranking_type, prob_col, score_col, limit, version, risky=False):
        data = frame.dropna(subset=[prob_col, score_col]).copy()
        data = data.sort_values(score_col, ascending=risky)
        for rank_no, (_, r) in enumerate(data.head(limit).iterrows(), start=1):
            display_p = 1.0 - float(r[prob_col]) if risky else float(r[prob_col])
            raw_score = 1.0 - float(r[score_col]) if risky else float(r[score_col])
            rows.append({
                "ranking_date": target_date,
                "character_code": character,
                "ranking_type": ranking_type,
                "rank_no": rank_no,
                "course_code": int(r["course_code"]),
                "race_no": int(r["race_no"]),
                "probability": display_p,
                "model_version": version,
                "summary": f"AI v2 shadow {display_p*100:.1f}%",
                "metrics": {
                    "bundle_version": mod.BUNDLE_VERSION,
                    "shadow": True,
                    "ranking_basis": "raw_lightgbm_probability",
                    "ranking_score": raw_score,
                    "display_probability_calibrated": True,
                    "is_female_race": bool(r["is_female_race"]),
                },
                "data_timing": timing,
            })

    boat1 = df[df["boat_no"] == 1]
    add(boat1, "ichika", "ichika_escape_best10", "ichika_probability", "ichika_rank_score", 10, ichika_v)

    female1 = boat1[boat1["is_female_race"]]
    add(female1, "hatsune", "hatsune_dominant_best3", "hatsune_probability", "hatsune_rank_score", 3, hatsune_v)
    add(female1, "hatsune", "hatsune_risky_best3", "hatsune_probability", "hatsune_rank_score", 3, hatsune_v, risky=True)

    boat5 = df[df["boat_no"] == 5]
    add(boat5, "kiina", "kiina_boat5_best5", "kiina_probability", "kiina_rank_score", 5, kiina_v)

    mod.api_post(
        "ai_v2_daily_rankings",
        rows,
        "ranking_date,data_timing,ranking_type,rank_no",
    )

    print(f"rebuilt rankings={len(rows)} for {target_date} / {timing}")
    for r in rows:
        print(
            f"{r['ranking_type']} #{r['rank_no']} "
            f"course={r['course_code']} race={r['race_no']} "
            f"display={r['probability']:.4f} raw={r['metrics']['ranking_score']:.6f}"
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rebuild AI v2 daily rankings using raw LightGBM scores")
    parser.add_argument("--date", default=str(date.today()))
    parser.add_argument("--timing", choices=["previous_day", "after_exhibition"], default="previous_day")
    args = parser.parse_args()
    rebuild(args.date, args.timing)
