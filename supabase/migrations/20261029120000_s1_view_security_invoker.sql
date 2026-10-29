-- S1：SECURITY DEFINER 相当のビュー5件を security_invoker にし、anon・authenticated の書き込みと非公開データの閲覧を止める。
-- 本番への適用は、承認済みの手順書（事前検査・自己検査つきの SQL）で手作業で行う。このファイルは、その変更をリポジトリに記録するためのもの。
-- 内容は何度実行しても同じ結果になる。
--
-- 変更前の問題：
--   ・v_bs_race_results_confirmed（bs_race_events の単純ビュー・自動更新可）を通して、anon が bs_race_events を INSERT・UPDATE・DELETE できた
--   ・v_bsc_official_performance・v_bsc_official_monthly_stats を通して、anon が非公開の買い目・投資額・損益を読めた
-- 注意：これらのビューを CREATE OR REPLACE VIEW で作り直すときは、WITH (security_invoker = true) を必ず付けること
--       （付けないと設定が消える）。scripts/check-view-security.mjs が CI で検査する。

revoke insert, update, delete, truncate, references, trigger on table
  public.v_bs_race_results_confirmed,
  public.v_elimination_training_races,
  public.v_elimination_training_entries,
  public.v_bsc_official_performance,
  public.v_bsc_official_monthly_stats
from anon, authenticated;

revoke select on table
  public.v_bsc_official_performance,
  public.v_bsc_official_monthly_stats
from anon, authenticated;

alter view public.v_bs_race_results_confirmed    set (security_invoker = true);
alter view public.v_elimination_training_races   set (security_invoker = true);
alter view public.v_elimination_training_entries set (security_invoker = true);
alter view public.v_bsc_official_performance     set (security_invoker = true);
alter view public.v_bsc_official_monthly_stats   set (security_invoker = true);
