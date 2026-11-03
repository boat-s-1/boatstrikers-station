# PHASE 2 手順書：Windows PC での実 AI 検証と、ステージングの SQL 動作テスト

対象：PR #295（ブランチ `claude/boatstrikers-blog-audit-krge6t`）。本番 DB・本番 Cron・環境変数・main は変更しない。

---

## A. Windows PC で実 AI 検証（一果・初音・キイナを各 1 回）

### A-1. この検証でやること・やらないこと
| やること | やらないこと |
|---|---|
| OpenAI に疎通確認を 1 回（出力 1,000 トークンまで） | 再試行（失敗してもやり直さない） |
| 記事の生成を最大 3 回（一果・初音・キイナ各 1 回） | 4 回目以降の生成、作り直し |
| 実データの集計との数値照合、7 ゲート、数値改ざん・期間削除の確認 | データベースへの書き込み（本番・ステージングとも） |
| 生成時間・トークン数・推定料金（単価を指定した場合）を記録 | 環境変数・リポジトリのファイルの変更 |
| 結果をリポジトリの**外**に保存（`report.json`・`summary.md`） | キーの表示・保存・ログ出力 |

- 使う実データは、本番から読み取りで書き出した `tests/blog/fixtures/real-data/`（桐生 2026/10/04〜10/26、全国の女子戦 2026/10/13〜10/26。どちらも欠損の無い期間）。コードの集計が本番の SQL と一致することはテストで常に確認している。
- データ品質の基準を満たさないケースは **AI を呼ばずに HOLD** と記録する（基準は緩めない・推測で埋めない）。日次運用のテーマ期間（365 日・90 日）では、現在、一果の 2 テーマと初音のテーマが 8 月の欠損で HOLD になる（`PHASE2-VERIFICATION.md` 3-1-2）。この検証はその期間では生成しない。

### A-2. 事前に必要なもの
1. **Node.js 20 以上**（`node -v` で確認。無ければ https://nodejs.org/ の LTS 版）。
2. **Git**（リポジトリの取得に使う）。
3. **OpenAI API キー**（下の A-3 を推奨）。
4. npm パッケージのインストールは**不要**（このスクリプトは Node.js の標準機能だけで動く）。

### A-3. キーについて（推奨・判断をお願いします）
- **推奨：この検証専用のキーを新しく発行し、検証後に無効化する。** 理由：本番の NEWS などで使っているキーを手元の PC に出さずに済み、万一の漏えいでも影響をこの検証に限れるため。
  - 手順：OpenAI の管理画面 → Projects で検証用のプロジェクト（または既存のプロジェクト）を選ぶ → API keys → Create new secret key（権限は「Restricted」にして Responses だけ書き込み可が望ましい）→ 表示されたキーをパスワード管理ソフトに一時保存。
  - 同じ画面の Limits（Usage limits / Budget）で、プロジェクトの月の上限額を少額に設定する。
  - 検証が終わったら、そのキーを Revoke（無効化）する。
- 既存のキーを使う場合も、コマンドやファイルには書かない（A-5 の画面に表示されない入力欄で入れる）。
- **やってはいけないこと**：`$env:OPENAI_API_KEY = "sk-…"` のようにコマンドとして打つ（PowerShell の履歴ファイル `ConsoleHost_history.txt` に残る）。`.env` などのファイルに書く。チャットや Issue に貼る。

### A-4. 料金の目安（上限）
- 呼び出しは最大 4 回（疎通確認 1 ＋ 記事 3）。出力の上限は疎通確認 1,000 トークン、記事 1 回 12,000 トークン → **出力は合計 37,000 トークンが上限**。
- 入力は 1 回あたり約 6,700〜7,500 文字（日本語中心の指示・集計データ・出力形式）。
- 単価は OpenAI の料金ページで、使うモデル（既定 `gpt-5.6-luna`。`--model` で変更可）の入力・出力の 1M トークンあたりの米ドルを確認し、`--price-input`・`--price-output` に指定すると推定料金を計算する。指定しない場合は「未設定」と記録し、実際の額は OpenAI の Usage 画面で確認する。

### A-5. 実行手順（PowerShell または Windows Terminal）
```powershell
# 1. 作業フォルダーで PR のブランチを取得（初回のみ clone）
git clone https://github.com/boat-s-1/boatstrikers-station.git
cd boatstrikers-station
git fetch origin claude/boatstrikers-blog-audit-krge6t
git switch claude/boatstrikers-blog-audit-krge6t

# 2. 念のため、AI を呼ばない検証（模擬応答）が通ることを確認（1〜2 秒、無料）
node scripts/blog/verify-real-articles.mjs tests/blog/fixtures/real-data/cases.json
#    → 3 行の結果が出て、各行 "verdict":"PASS" であること

# 3. 実 AI 検証（キーはコマンドに書かない）
node scripts/blog/run-local-ai-verification.mjs --price-input <入力単価> --price-output <出力単価>
#    単価が分からなければ --price-… は省略してよい（推定料金は「未設定」になる）
```
実行すると次の順に進む。
1. 「OpenAI APIキーを入力してください（画面には表示されません）」→ キーを貼り付けて Enter（文字は表示されない）。
2. モデル・呼び出し回数・出力上限・保存先が表示される →  **y** を入力して Enter（それ以外なら何も呼ばずに終了）。
3. 疎通確認 → 一果 → 初音 → キイナ の順に結果が 1 行ずつ表示される。
4. 最後に「保存しました：…\summary.md」と表示される。保存先の既定は `C:\Users\<ユーザー名>\boatstrikers-blog-ai-verification\<日時>\`。

終わったら：
- クリップボードにキーが残っている場合は消す：`Set-Clipboard -Value " "`
- 検証専用キーを発行した場合は、OpenAI の画面で Revoke する。
- `summary.md`（と必要なら `report.json`）の**中身**を共有する。キーは含まれない（保存前にスクリプトが確認し、含まれていれば保存を中止する）。

### A-6. 結果の見方
| 項目 | 意味 | 期待すること |
|---|---|---|
| 判定（PASS / RETRY / HOLD） | 7 ゲートの結果 | 実 AI の文章なので RETRY・HOLD もありうる。その理由（各ゲート）を記録して評価する |
| 数値改ざん | 本文の数値を 1 つ変えた写しの判定 | **必ず HOLD**（違えば検査の不具合） |
| 期間削除 | 本文から集計期間を消した写しの判定 | **PASS にならない** |
| 入力・出力トークン、時間 | 1 記事あたりの実測 | 7 日間試験の費用と所要時間の見積もりに使う |
| 再生成回数 | 0 回（この検証では作り直さない） | — |

### A-7. うまくいかないとき
| 表示 | 意味 | 対処 |
|---|---|---|
| 疎通確認 NG（auth） | キーが違う・無効 | キーを確認して再実行（API は 1 回呼ばれただけ） |
| 疎通確認 NG（quota） | 支払い・上限・回数制限 | OpenAI の Billing / Limits を確認 |
| 疎通確認 NG（network / timeout） | 通信できない | 社内ネットワークのプロキシ等を確認 |
| 「リポジトリの一番上のフォルダーで実行してください」 | 実行場所が違う | `cd boatstrikers-station` してから実行 |
| 「Node.js 20 以上が必要です」 | Node.js が古い | LTS 版を入れ直す |
| 記事の行が「失敗（request）」 | モデル名・パラメーターを受け付けない | `--model` で利用可能なモデルを指定（再実行は承認後） |

---

## B. ステージングの 14 項目の SQL 動作テスト（Supabase SQL Editor で手動実行）

### B-1. 安全性の前提
- 対象は**ステージング**（プロジェクト名 `boatstrikers-blog-staging`、ID `usieipnicxzzwgrzngtt`）だけ。本番（`boat-s-1's Project`、`rzosrbkyniyedolhkgxo`）では実行しない。スクリプトは、レース用の表がある DB（本番）や、既存記事に予約がある DB では最初に止まる。
- テストは 1 つの DO ブロック（1 文）で、COMMIT を含まず、**最後に必ずエラーを出して全体を取り消す**。成功・失敗・途中のタイムアウト・接続の切断のどれでも、何も残らない。連番・外部通信・Realtime など取り消されない副作用は無い（確認済み）。
- SQL Editor が「破壊的な操作を含む」旨の確認を出した場合は、**画面上部のプロジェクト名がステージングであることを確かめてから**実行を許可する。

### B-2. 手順
1. Supabase のダッシュボードで **boatstrikers-blog-staging** を開き、左のメニューから SQL Editor を開く。画面上部のプロジェクト名を確認する。
2. 新しいクエリに、次の**実行前の確認**（読み取りのみ）を貼り付けて Run。結果の 1 行を控える（スクリーンショットで可）。
   ```sql
   select md5(string_agg(id::text||state||coalesce(published_revision_id::text,'')||coalesce(scheduled_revision_id::text,'')||edit_version, ',' order by id)) posts_md5,
     (select count(*) from public.blog_publication_events) events, (select count(*) from public.blog_ai_approvals) approvals,
     (select count(*) from public.blog_ai_gate_results) gate_results, (select count(*) from public.blog_ai_auto_publications) auto_pubs,
     (select count(*) from public.blog_ai_jobs) jobs, (select row_to_json(s) from public.blog_ai_settings s) settings
   from public.blog_posts;
   ```
   2026-11-03 13:32 UTC 時点の値：posts_md5 `52b5967d06ab76c0f7816affee7b1666`、events 17、approvals 0、gate_results 0、auto_pubs 0、jobs 0、settings は manual・自動公開 false・生成 false・06:00。
3. 別の新しいクエリに、リポジトリの `ops/blog/ai-quality-gates-behavior-test.sql` の**全文**を貼り付けて Run。
4. 結果を確認する：
   - **合格**：`ERROR: P0001: BLOG_AI_GATES_BEHAVIOR_TEST_OK: 14 checks passed`（エラーと表示されるが、これが合格。全体が取り消された印）
   - **不合格**：`BLOG_AI_GATES_BEHAVIOR_TEST_FAILED: <番号> …` → そこで止めて、メッセージを共有する。
   - **拒否**：`BLOG_AI_GATES_BEHAVIOR_TEST_REFUSED: …` → 本番を開いている・予約がある等。プロジェクトを確認する。
5. もう一度、手順 2 の**実行前の確認**を Run し、値が手順 2 と**完全に同じ**であることを確かめる（settings の updated_at も同じ）。
6. 手順 4 のメッセージと、手順 2・5 の値を共有する（こちらでも読み取りで照合する）。

### B-3. 何を確かめるテストか（14 項目）
1. 初期設定が手動承認・自動公開 OFF・生成 OFF
2. OFF の間は PASS でも自動承認できない
3. 7 ゲートのどれかが不合格なのに全体を PASS とする記録は表が拒否
4. HOLD の版は人が承認しても公開・予約できない
5. 権限のあるロールが行を直接書き換えても公開できない
6. 自動モードでは PASS の記事を予約できる
7. 緊急停止すると、その予約は予約公開ワーカーに飛ばされる（公開されない）
8. 再開すると公開される
9. 公開直前の本文の書き換えは拒否され、承認も残らない
10. 自動公開は日本時間で 1 日 1 本（2 本目は拒否）
11. 日次ジョブは 2 つ目の実行者が同じ日を取れず、許されない状態遷移は拒否
12. 検査結果と自動公開の記録は書き換え・削除できない
13. anon / authenticated から新しい表・関数に触れない
14. 既存の記事は変わらない
