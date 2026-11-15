# BATCH1 再構築報告（2026-11-15 JST）

## 範囲と到達点

最新main bfe285759b8f819669e920875495c642039b21a0から、ローカルbranch codex/batch1-reconstructed-20261115で再実装。
失われた旧HEADの復元ではなく、仕様を再確認した新しい実装。旧116件のテスト結果は流用していない。
今回の新しい実行は130件PASS / FAIL 0 / skipped 0。実行ログはbatch1-reconstruction/offline-tests.tap。

|案件|再構築内容|検証・残る条件|
|---|---|---|
|S01|非SELECT権限を取り消す未適用SQL、catalog/backup/関数driftで停止、事前read-only検査、正確なcatalogから緊急rollback SQLを生成|静的構造検査のみ。PostgreSQLなし。実SQL・API権限・バックアップ復元は未検証。本番HOLD|
|S02|表示はSELECTだけ。既存管理認証をページとActionで確認、暦日と確認チェック、手動digest生成禁止。Cron/手動の共通claim、DB返却updated_atを丸めず保存/cleanupのCASに使用|20並列、owner交代、draft/posted保護、失敗回復、認証/確認/日付、NEWS非書込をfake DBで検証。実PostgREST/Next画面は未検証|
|TRINITY|公式index/race/parse/intake通信・JSON・statusの失敗段階とHTTP statusを付与。診断はHTML/資格情報を含めない|合成fetchによるCLIと既存parser/時刻guard/同一入力V2/V3回帰。再収集/保存/API実呼出しなし。停止原因解消や稼働復旧は未判定|
|RSS|note RSS 503/形式不正を取得不可表示へ変換。成功した空feedと区別。従来の絞込・20件上限・画像を維持|fake parser成功/障害検証。本物のRSS GET/Next buildなし|
|隔離|正確なBATCH1名2つだけVercel自動deploy=false案。既存2CIと公式probeをBATCH1だけskip。専用CIはubuntu-24.04、10分、PR openedのみ、依存installなし、OS隔離必須|既存20Cron完全一致、通常CIとの差分がbranch条件のみ。OS unshareはローカルでOperation not permitted。CI実行なし|
|静的レビュー|fs/path/urlだけの依存0ビルド。DB/認証/API/Functions/Cronなし、資格情報混入を出力前に拒否、CSPで外部通信禁止|temp directoryに3ファイルを生成するテスト。実アプリのPreview/E2Eではない。Vercel作成/設定/ビルドは未実施|

CronのURL・時刻・認証コードは変更していない。S02のgenerator内だけは安全性対策として共有leaseに変更しており、適用後はCronが既存draftを上書きせずskipする。これは実装候補の挙動で、本番には適用していない。

## 入力資料・既存PR

GitHub mainをcloneし、20 open PRのHEADと差分対象を照合。PR #278 HEAD24825994ebdcb3a621aff592462b043a5b43e24dのpage/buttonを出発点にし、旧claimの所有権欠落を置換。
変更パスの重複は#278のDATA LAB 4ファイルと#86のvercel.json。重複はmerge conflictの証明ではない。既存PRへcommit/コメント/mergeはしていない。
取得時のmainと終了前のls-remoteは同じ。入力一覧はbatch1-reconstruction-sources.json、重複一覧はbatch1-reconstruction/pr-overlaps.json。
保存済み台帳・隔離設計・公開前報告を読み、過去のSQL試験や本番監査値を今回の試験として扱わなかった。

## 検証方法と制限

依存のダウンロード・npm installなし。env -i、NodeのHTTP/TCP/TLS/DNS/UDP拒否shim、明示的fake DB/fetchで実行。
fake fetchは外部へ送らない合成応答で、native transportの拒否は維持。通信shimはOSのsecurity boundaryの代替ではない。
ローカルOS隔離失敗は記録し、隔離CIを普通のネットワークで実行し直していない。将来のCIも隔離検査を通る前にテストしない。
既存ソース取得・GitHub metadata・公式技術資料・保存資料への読み取りはテストとは別に実施。BOAT RACE公式GETは0。
YAMLを既存Python parserで読み取り、変更した非JSX JSをnode --checkし、git diff --checkを実施。
全Next build/JSX compiler/ブラウザ/実PostgreSQL/API/本番確認は未実施。テスト合格を本番稼働完了とはしない。

## HOLDと戻し方

Push、PR作成、Vercel設定/ビルド、新規project、Actions、公式GET、実データ保存、生成API、資格情報変更、DB変更、merge、本番deployを実施していない。
新たな課金処理は起動していない。今回はホスト型CI/Vercelの請求対象処理を起動していないが、契約請求明細全体を確認したわけではない。
ローカルbranchのみ。戻す場合はこのbranchを利用しなければよく、既存main/他PR/Cron/認証の復旧は不要。
本番SQLはバックアップ/rollback出力/実SQL検証/改めての本番承認が揃うまでHOLD。

## 復元用成果物

ZIPに差分Git bundle、binary/full-index完全patch、変更ファイル現物、manifest、内部SHA256SUMS、復元手順、テストログを収録する。
差分bundleにはmain基準commitが前提として必要。巨大な既存public画像・main全履歴は重複収録しない。
bundleとpatchはそれぞれ、ローカルにある基準commitだけを利用して復元し、HEAD/treeの一致を確認する。検証結果はZIPのRECOVERY-VERIFICATION.txt。
最終commit SHA/tree SHAと変更ファイル一覧はZIP内MANIFEST.json/CHANGED-FILES.txtを正とする。

## 一次資料

- https://www.postgresql.org/docs/17/sql-revoke.html
- https://supabase.com/changelog.md
- https://vercel.com/docs/project-configuration/git-configuration
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners

資料の仕様確認は実プラットフォーム上の動作確認とは区別する。
