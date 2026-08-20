#!/usr/bin/env python3
import argparse
import importlib.util
import json
import os
from datetime import date, datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
BASE_PATH = HERE / "infer-daily.py"
spec = importlib.util.spec_from_file_location("bs_ai_v2_base", BASE_PATH)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

ARTIFACT_DIR = HERE / "artifacts"
FEATURE_VERSION = "ai-v2-selected-v1"
BUNDLE_VERSION = "ai-v2-shadow-selected-v1"

CORE = ["national_win_rate","national_2_rate","local_win_rate","local_2_rate","motor_2_rate","boat_2_rate"]
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

SELECTED = {
    ("ichika_target","previous_day"): ("ichika_target__previous_day__lgbm_v1", "isotonic", 1),
    ("ichika_target","after_exhibition"): ("ichika_target__after_exhibition__lgbm_v1", "isotonic", 1),
    ("hatsune_target","previous_day"): ("hatsune_target__previous_day__lgbm_v2", "platt", 1),
    ("hatsune_target","after_exhibition"): ("hatsune_target__after_exhibition__lgbm_v1", "isotonic", 1),
    ("kiina_target","previous_day"): ("kiina_target__previous_day__lgbm_v2", "platt", 5),
    ("kiina_target","after_exhibition"): ("kiina_target__after_exhibition__lgbm_v2", "platt", 5),
}


def add_race_features(df, target_boat):
    keys = ["race_date","course_code","race_no"]
    g = df.groupby(keys, dropna=False)
    target = df[df["boat_no"] == target_boat].copy()
    target = target.rename(columns={c: f"own_{c}" for c in BASE + EXH if c in target.columns})
    race_mean = g[CORE].mean().rename(columns={c: f"race_mean_{c}" for c in CORE}).reset_index()
    race_max = g[CORE].max().rename(columns={c: f"race_max_{c}" for c in CORE}).reset_index()
    boat1 = df[df["boat_no"] == 1][keys + CORE].rename(columns={c: f"boat1_{c}" for c in CORE})
    boat2 = df[df["boat_no"] == 2][keys + CORE].rename(columns={c: f"boat2_{c}" for c in CORE})
    boat5 = df[df["boat_no"] == 5][keys + CORE].rename(columns={c: f"boat5_{c}" for c in CORE})
    out = target.merge(race_mean,on=keys,how="left").merge(race_max,on=keys,how="left")
    out = out.merge(boat1,on=keys,how="left").merge(boat2,on=keys,how="left").merge(boat5,on=keys,how="left")
    for c in CORE:
        own=f"own_{c}"
        out[f"diff_vs_mean_{c}"]=out[own]-out[f"race_mean_{c}"]
        out[f"diff_vs_max_{c}"]=out[own]-out[f"race_max_{c}"]
        out[f"diff_vs_boat1_{c}"]=out[own]-out[f"boat1_{c}"]
        out[f"diff_vs_boat2_{c}"]=out[own]-out[f"boat2_{c}"]
        out[f"diff_vs_boat5_{c}"]=out[own]-out[f"boat5_{c}"]
    inner=df[df["boat_no"].between(1,4)].groupby(keys)[CORE].mean().rename(columns={c:f"inner14_mean_{c}" for c in CORE}).reset_index()
    out=out.merge(inner,on=keys,how="left")
    for c in CORE:
        out[f"diff_vs_inner14_{c}"]=out[f"own_{c}"]-out[f"inner14_mean_{c}"]
    return out


def load_specialist(version, calibration):
    packed=joblib.load(ARTIFACT_DIR/f"{version}.joblib")
    suffix="__platt.joblib" if calibration=="platt" else "__isotonic.joblib"
    calibrator=joblib.load(ARTIFACT_DIR/f"{version}{suffix}")
    return packed["model"], packed["features"], calibrator


def specialist_predict(df, target, timing, female_only=False):
    version, calibration, boat_no=SELECTED[(target,timing)]
    if version.endswith("lgbm_v1"):
        mask=(df["boat_no"]==boat_no)
        if female_only:
            mask=mask & (df["is_female_race"]==True)
        _, calibrated=base.predict_head(df,target,timing,mask)
        # raw score from the same v1 model for ranking.
        packed=joblib.load(ARTIFACT_DIR/f"{version}.joblib")
        raw=pd.Series(np.nan,index=df.index,dtype="float64")
        idx=df.index[mask]
        if len(idx):
            X=df.loc[idx,packed["features"]].copy()
            if "is_female_race" in X.columns:
                X["is_female_race"]=X["is_female_race"].astype("float32")
            for c in X.columns: X[c]=pd.to_numeric(X[c],errors="coerce")
            raw.loc[idx]=packed["model"].predict_proba(X)[:,1]
        return version,calibrated,raw

    work=add_race_features(df,boat_no)
    if female_only:
        work=work[work["is_female_race"]==True].copy()
    model,features,calibrator=load_specialist(version,calibration)
    X=work[features].copy()
    for c in X.columns: X[c]=pd.to_numeric(X[c],errors="coerce")
    raw_arr=model.predict_proba(X)[:,1]
    z=np.log(np.clip(raw_arr,1e-6,1-1e-6)/(1-np.clip(raw_arr,1e-6,1-1e-6))).reshape(-1,1)
    cal_arr=calibrator.predict_proba(z)[:,1]
    keys=["race_date","course_code","race_no"]
    scored=work[keys].copy(); scored["cal"]=cal_arr; scored["raw"]=raw_arr
    merged=df[keys].merge(scored,on=keys,how="left")
    cal=pd.Series(merged["cal"].to_numpy(),index=df.index,dtype="float64")
    raw=pd.Series(merged["raw"].to_numpy(),index=df.index,dtype="float64")
    mask=df["boat_no"]==boat_no
    cal=cal.where(mask,np.nan); raw=raw.where(mask,np.nan)
    return version,cal,raw


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--date",default=str(date.today()))
    ap.add_argument("--timing",choices=["previous_day","after_exhibition"],default="previous_day")
    ap.add_argument("--cutoff",default=None)
    args=ap.parse_args()
    cutoff=args.cutoff or datetime.now().astimezone().isoformat()
    raw=base.fetch_source(args.date)
    df=base.prepare_features(raw,args.timing)
    races=df[["course_code","race_no"]].drop_duplicates().shape[0]
    print(f"[{args.timing}] source: {len(df):,} rows / {races:,} races for {args.date}")

    versions={}
    versions["first"],df["first_probability"]=base.predict_head(df,"is_first",args.timing)
    versions["second"],df["second_probability"]=base.predict_head(df,"is_second",args.timing)
    versions["third"],df["third_probability"]=base.predict_head(df,"is_third",args.timing)
    versions["ichika"],df["ichika_probability"],df["ichika_raw"]=specialist_predict(df,"ichika_target",args.timing,False)
    versions["hatsune"],df["hatsune_probability"],df["hatsune_raw"]=specialist_predict(df,"hatsune_target",args.timing,True)
    versions["kiina"],df["kiina_probability"],df["kiina_raw"]=specialist_predict(df,"kiina_target",args.timing,False)

    rows=[]
    used=base.BASE_FEATURES+(base.EXHIBITION_FEATURES if args.timing=="after_exhibition" else [])
    for _,r in df.iterrows():
        rows.append({
            "race_date":args.date,"course_code":int(r["course_code"]),"race_no":int(r["race_no"]),"boat_no":int(r["boat_no"]),
            "data_timing":args.timing,"model_version":BUNDLE_VERSION,"model_versions":versions,"feature_version":FEATURE_VERSION,
            "first_probability":base.json_safe(r["first_probability"]),"second_probability":base.json_safe(r["second_probability"]),"third_probability":base.json_safe(r["third_probability"]),
            "ichika_probability":base.json_safe(r["ichika_probability"]),"hatsune_probability":base.json_safe(r["hatsune_probability"]),"kiina_probability":base.json_safe(r["kiina_probability"]),
            "feature_snapshot":{c:base.json_safe(r.get(c)) for c in used},
            "explanation":{"mode":"shadow_selected","specialist_raw":{"ichika":base.json_safe(r.get("ichika_raw")),"hatsune":base.json_safe(r.get("hatsune_raw")),"kiina":base.json_safe(r.get("kiina_raw"))}},
            "data_cutoff_at":cutoff,"predicted_at":datetime.now().astimezone().isoformat(),
        })
    base.api_post("ai_v2_predictions",rows,"race_date,course_code,race_no,boat_no,data_timing,model_version")

    ranking_types=["ichika_escape_best10","hatsune_dominant_best3","hatsune_risky_best3","kiina_boat5_best5"]
    for rt in ranking_types:
        base.api_delete("ai_v2_daily_rankings",{"ranking_date":f"eq.{args.date}","data_timing":f"eq.{args.timing}","ranking_type":f"eq.{rt}"})
    out=[]
    def add(frame,character,rt,prob,rawcol,limit,version,inverse=False):
        d=frame.dropna(subset=[prob,rawcol]).copy()
        d=d.sort_values(rawcol,ascending=inverse)
        for n,(_,r) in enumerate(d.head(limit).iterrows(),1):
            display=(1-float(r[prob])) if inverse else float(r[prob])
            rawscore=(1-float(r[rawcol])) if inverse else float(r[rawcol])
            out.append({"ranking_date":args.date,"character_code":character,"ranking_type":rt,"rank_no":n,"course_code":int(r["course_code"]),"race_no":int(r["race_no"]),"probability":display,"model_version":version,"summary":f"AI v2 shadow {display*100:.1f}%","metrics":{"bundle_version":BUNDLE_VERSION,"raw_ranking_score":rawscore,"shadow":True},"data_timing":args.timing})
    boat1=df[df["boat_no"]==1]
    add(boat1,"ichika","ichika_escape_best10","ichika_probability","ichika_raw",10,versions["ichika"])
    fb1=boat1[boat1["is_female_race"]==True]
    add(fb1,"hatsune","hatsune_dominant_best3","hatsune_probability","hatsune_raw",3,versions["hatsune"])
    add(fb1,"hatsune","hatsune_risky_best3","hatsune_probability","hatsune_raw",3,versions["hatsune"],True)
    boat5=df[df["boat_no"]==5]
    add(boat5,"kiina","kiina_boat5_best5","kiina_probability","kiina_raw",5,versions["kiina"])
    base.api_post("ai_v2_daily_rankings",out,"ranking_date,data_timing,ranking_type,rank_no")
    print(f"saved predictions={len(rows)}, rankings={len(out)}")
    for r in out:
        print(f"{r['ranking_type']} #{r['rank_no']} course={r['course_code']} race={r['race_no']} display={r['probability']:.4f} raw={r['metrics']['raw_ranking_score']:.6f} model={r['model_version']}")

if __name__=="__main__": main()
