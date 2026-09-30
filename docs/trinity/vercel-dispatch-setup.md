# 前夜公式出走表のVercel起動経路

GitHub Actions の `schedule` は2026-09-30に予定時刻から数時間遅れて起動した。前夜21:00–23:59 JSTの外では提出しない安全制限を維持する。

Vercel Cron は `/api/cron/trinity-previous-day-dispatch` を毎日21:05・22:05・23:05 JST（UTC 12:05・13:05・14:05）に呼ぶ。関数は `CRON_SECRET` を認証し、JSTの前夜時間帯を確認してからGitHub Actionsの固定ワークフローを `workflow_dispatch` で起動する。実際の公式HTMLの取得・入力検証・不変保存は引き続きGitHub Actionsと本番APIが行う。提出HTMLの取得元は独立検証されるまで `operator_submitted_html` のまま扱う。

本番有効化にはVercel Production環境に `TRINITY_GITHUB_DISPATCH_TOKEN` を設定する。対象は `boat-s-1/boatstrikers-station` だけ、fine-grained personal access token のリポジトリ権限は **Actions: Read and write** に限定する。値をコード、GitHub Actionsログ、URLに書かない。`CRON_SECRET` は既存の本番値を使う。

設定後にプレビューではなく本番で、許可時間内の起動履歴と `trinity_official_entry_sources` / `trinity_prediction_snapshots` の同一入力V2/V3ペアを確認する。時間外はHTTP 503で安全に停止し、レース当日のデータを前日版として補完しない。GitHub側の `schedule` は補助として残る。V3候補と公開TRINITYは変更しない。
