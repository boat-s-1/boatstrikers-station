# 新聞 前日版自動下書き PHASE 2 — 自動下書き生成（未導入）

対象ブランチ：`feature/newspaper-auto-draft-phase1`（PHASE 1 の上に積んでいる）。Cron 登録・本番DB操作・デプロイはしていない。

## 何をするか

レース当日の展示前予想（`ai_v2_daily_rankings`、`data_timing=previous_day`）から、一果・初音・キイナの前日版新聞を **各1件まで** 自動で作り、`bs_newspaper_publications` に **draft** で保存する。公開はしない。

| キャラ | 候補（既存の選定ルールのまま） | 1日の上限 |
|---|---|---|
| 一果 | `ichika_escape_best10` を順位順 | 1 |
| 初音 | `hatsune_dominant_best3` → `hatsune_risky_best3` を順位順 | 1 |
| キイナ | `kiina_boat5_best5` を順位順 | 1 |

候補を上から確認し、条件を満たした最初のレースだけを作る。AI生成・数値照合・保存のどこかで失敗した場合、同じ実行では次の候補に進まない（同時実行時に別レースを選ばないため）。

## 作らない条件（記録される見送り理由）

`invalid_probability` 確率が無い・範囲外／`invalid_course`・`invalid_race_no`・`invalid_rank`／`exists` 同じレース・キャラの前日版が既にある（手動・自動・公開済みを問わない）／`race_finished` 結果確定／`race_event_missing`・`closing_time_unknown` 締切時刻を確認できない／`race_closed` 締切20分前を過ぎた／`retry_limit` 同じレースで2回失敗済み／`entries_incomplete` 出走表が1〜6号艇そろっていない／`insights_fallback`・`insights_unverifiable` 初音の艇別データが足りない

## 使うデータ・使わないデータ

- 使う：`ai_v2_daily_rankings`（previous_day）、`bsc_official_predictions`（凍結済み公式買い目がある場合のみ）、`bs_race_entries`（勝率・ST・モーター等。**展示列は読まない**）、`bs_race_events`（締切時刻）、`bs_race_results`（結果の有無）
- 使わない：前夜取得の公式出走表（TRINITY 系テーブル）、手動画面の初期値（全国平均73%・各艇評価など）、`ichika` の全国平均、各艇評価スコア

## 数値の照合（factGuard）

保存するすべての文字列（タイトル・要約・サイト記事・note・X投稿・Shorts台本）について、数値ごとに次を確認する。1つでも確認できなければ保存しない（`fact_guard_rejected`）。

- `%` の数値：同じ文の直前（24文字以内）に、その値を持つ項目名（例：イン逃げ率／女子戦期待度／穴狙い期待度）がある
- 艇別データ（初音のチェックポイント）：項目名・値に加え、最も近い「N号艇」が元データの艇と一致
- 日付・レース番号・艇番（1〜6）・買い目（凍結済みのものだけ）・金額（1点・合計）・点数・順位：それぞれ元データと一致
- 時刻・回数・別レース番号・漢数字の数値・内部用語は検証できないので不合格

## 安全装置

| 状態 | 動作 |
|---|---|
| `CRON_SECRET` が一致しない | 401。DB接続しない |
| `VERCEL_ENV=production` かつ `NEWSPAPER_AUTO_DRAFT_ALLOW_PRODUCTION≠true` | 何もしない（`blocked`）。dry_run も不可 |
| `?dry_run=1` | DB読み取りのみ。AI呼び出し・書き込み・ログ記録なし。`date` 指定可 |
| `NEWSPAPER_AUTO_DRAFT_ENABLED≠true` | 何もしない（`disabled`）。DB接続もしない |
| `NEWSPAPER_AUTO_DRAFT_SLOT_CONSTRAINT≠true`（PHASE 2.5） | 書き込まない（`blocked`）。「1日・1キャラ・1件」のDB制約（`docs/newspaper/proposals/auto-draft-slot.sql`）を作成済みであることを示すフラグ |
| 有効 | 当日分のみ。`auto_draft_generator` 列付きで INSERT し、一意制約（レース単位・キャラ日単位）に当たれば作らない。既存行は更新しない |

実行結果は `bs_news_sync_logs`（`run_type=newspaper_auto_draft`、`details.results` にキャラごとの結果・見送り理由・照合で不合格になった箇所）に記録する。新しいテーブルは作っていない。

## 確認画面

`/admin/newspaper-drafts`（閲覧専用）。日付ごとに自動下書き・実行ログ・手動の前日版を表示する。保存・公開はこの画面からはできない。

## 並列実行の保証（PHASE 2.5）

既存の一意キーは同じレースの重複しか防げないため、同時実行の2つが別レースを選ぶと1キャラ2件になりうる。`auto_draft_generator` 列と部分ユニーク索引 `(race_date, character_key, edition) where auto_draft_generator is not null` をDBに作り、INSERT が 23505 になれば作らない。アプリは制約の作成済みフラグが無い限り書き込まない（fail-closed）。手動で編集・公開しても列は残るため、その日の自動枠として数え続ける。詳細と適用SQLは `docs/newspaper/proposals/auto-draft-slot.sql`（未適用）。

## 導入手順（すべて承認後に実施）

1. 本番DBで `docs/newspaper/production-readonly-checks.sql`（読み取り専用）を実行し、生成時刻・候補数・6艇充足率・締切時刻の欠損率・凍結買い目・既存新聞との重複を確認する。
1b. 承認後、`docs/newspaper/proposals/auto-draft-slot.sql` を正式なマイグレーションとして適用する。
2. PHASE 1・2 をプレビュー環境へデプロイ（`NEWSPAPER_AUTO_DRAFT_ENABLED` は未設定）。管理画面の新聞作成と保存の動作を確認する。
3. プレビューで `?dry_run=1` を手動実行し、候補と見送り理由を確認する（本番環境では `blocked`）。
4. 本番デプロイ（`NEWSPAPER_AUTO_DRAFT_ENABLED` 未設定のまま）。
5. 承認を得て `NEWSPAPER_AUTO_DRAFT_ALLOW_PRODUCTION=true` を設定し、本番で dry_run を1回実行。
6. 承認を得て `NEWSPAPER_AUTO_DRAFT_SLOT_CONSTRAINT=true`（制約の適用後のみ）と `NEWSPAPER_AUTO_DRAFT_ENABLED=true` を設定し、手動で1回実行。下書きの内容と数値を管理画面で確認する。
7. 承認を得て `vercel.json` に Cron を追加（案：`*/20 21-23 * * *` UTC = JST 06:00〜08:40）。
8. 停止は `NEWSPAPER_AUTO_DRAFT_ENABLED` を外すだけ。作成済みの下書きは `source_payload->>'generator' = 'auto-previous-day-v1' and status = 'draft'` で特定できる。

## テスト

```bash
node --test tests/newspaper/*.test.mjs
```
