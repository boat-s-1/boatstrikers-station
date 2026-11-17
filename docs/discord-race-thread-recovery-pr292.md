# Discordレース実況：障害復旧手順（PR #292／Draft）

## 原則
- **自動再送しない。** `sending`・`unknown`・`sent`・`failed` は自動claim対象外。Discord POST後のタイムアウトは「未投稿」の証明ではない。
- 本番のCronは停止したまま調査する。対象日・場コード・レース番号・message_keyで1件ずつ照合する。
- 投稿本文・メッセージID・スレッドID・親チャンネル・レース識別子を確認する。名前だけの一致は根拠にしない。
- **DB変更・手動再送・Cron再開は別途承認が必要。** この手順は自動復旧機能ではない。

## 読み取り専用で確認
1. Cronログの `raceDate`、`failed`、`deferred`、`characterPosts`、エラー文を記録する。部分失敗時の `characterPosts` はDBに保存確認できたキャラクター投稿数のみ。
2. Supabaseで対象履歴をSELECT（実行対象プロジェクトを必ず確認）：

```sql
select race_date,course_code,race_no,message_key,state,
       discord_thread_id,discord_message_id,attempt_count,
       claimed_at,updated_at,last_error
from public.bs_discord_race_thread_deliveries
where race_date = :race_date and course_code = :course_code and race_no = :race_no
order by case message_key
  when 'thread' then 0 when 'starter' then 1
  when 'ichika' then 2 when 'hatsune' then 3 else 4 end;
```

3. Discord APIの**GETのみ**で保存済みスレッドIDを取得し、ID・parent_id・name・type=11・thread_metadata.archived=falseを照合。スレッド内のメッセージ一覧を読み取り、投稿者・本文・時刻・メッセージIDを突き合わせる。Discord権限や保存期間により照合できない場合はHOLD。
4. 判定表に従い、人間が証拠を記録する。

| DB状態 | Discord側の確認 | 対応 |
|---|---|---|
| sent | IDと内容が一致 | 完了。再送しない |
| sending / unknown | 投稿の存在を確認 | 証拠を保存し、DB状態の手動補正を別途審査。再送しない |
| sending / unknown | 投稿が見つからない | 見つからないことは未投稿の証明ではない。HOLD、再送しない |
| pending | 投稿が存在しないことを確認 | 次回の自動claim候補。ただしCron再開は別途承認 |
| failed | 任意 | 原因を確認し、手動で再試行可否を審査。自動再送しない |
| thread=sentだがDiscordが不一致/削除/archived | 任意 | HOLD。別スレッドを自動作成しない |

## DB補正・復旧の承認ゲート
- 対象の一意キー、現状state、Discord証跡、変更理由、承認者、変更前バックアップを記録する。
- 変更する場合は1件ごとの条件付き更新と更新件数検証を設計し、監査ログを残す。**本書には本番更新SQLを含めない。**
- `unknown`→`pending` の無条件リセットや一括リトライは禁止。
- 一果・初音・キイナのメッセージはそれぞれ別キー。成功済みキャラクターを再送しない。
- 再開前にPreview/CIで権限、並列claim、部分失敗、重複防止を再検証し、Discord実APIの読み取り専用照合結果を確認する。

## 現時点の証拠と未完了
- GitHub Actions（コミット `edef5e3d`）: モック21/21 PASS、隔離PostgreSQL並列claim・権限・unknownロックアウト PASS。
- Supabase隔離Previewは検証後削除済み。**本番DBにはマイグレーション未適用**。
- 実Discord APIでの読み取り専用照合、実際のタイムアウト後のDiscord側存在確認、運用監視・停止手順の実環境検証は未実施。
- **本番導入判定：HOLD。**
