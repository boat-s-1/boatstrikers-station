# TRINITY公式出走表の前夜取得

- 21:00〜23:55 JST、公式の翌日開催一覧から開催場を取得する。5分間隔のCronが未保存レースの公式出走表を取得し、6艇と締切予定時刻を検査する。予想に使用する2つの公式HTML表（締切予定時刻と6艇）の原文、SHA-256、取得時刻、6艇の正規化前日特徴量を `trinity_official_entry_sources` に一度だけ保存する。
- 公式表には性別が掲載されていないため、登録番号を5桁にそろえ、取得時刻以前に作成・更新された過去 `bs_race_entries.gender_code` / `sex_code` から同一選手を特定する。6艇全員の性別を確認できないレースは保存を見送る。元レース日と元行の時刻を `gender_evidence` に残す。体重や名前から性別を推測しない。
- 固定した入力からV2と**条件を変えない**V3 candidate-01を同じ時刻に生成し、同じ `official_source_id` に紐付けてペア保存する。予想結果や当日展示情報は参照しない。結果は既存の別テーブルに後日保存する。
- 公式の原文・予想はUPDATE/DELETE/TRUNCATE禁止。公式出走表を取得した日の翌日だけ `previous_day` を許すDBガードを設ける。既存の展示後保存と公開TRINITYは変更しない。
- 出走取消や翌朝の変更は元の前夜情報を書き換えない。現行の公式レース結果による決済可否と合わせて監査する。取得できなかったレースを翌朝に「前日版」として補完しない。

## 本番点検

1. `trinity_official_entry_sources` の最初の `captured_at` が対象日の前夜であること、HTMLのSHAと保存入力の6艇が一致することを確認する。
2. 同じレースに対する `trinity_prediction_snapshots` はV2とcandidate-01の2件、`source_captured_at`、`generated_at`、`official_source_id` と `boat_features` が同じであることを確認する。
3. Vercelログの `trinity official previous-day cron complete` で保存件数・取得エラー・性別参照不足を確認し、当日朝の同期結果とは別の集計にする。
4. 公式サイトからVercel実行環境への接続が失敗した場合はエラーとして記録し、予想を作らない。
