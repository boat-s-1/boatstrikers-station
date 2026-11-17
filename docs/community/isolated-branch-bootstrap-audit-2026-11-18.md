# 隔離ブランチ初期化検査（2026-11-18）

## Branch
- Supabase branch: community-acl-isolation-20261118
- branch id: dcc21b22-2505-4bd7-9435-8b2560c7d321
- project ref: qcggydjyxdsfwqnxshyb
- preview_project_status: ACTIVE_HEALTHY
- DB: PostgreSQL 17.12
- with_data=false（本番データ複製なし）

## 重要な初期化問題
本番mainのmigration historyは2026-11-16のs01 migrationまで100件超を含むが、新規branchでlist_migrationsが返したのは2026-08-19〜08-20の11件のみ。bs_member_profilesテーブルも存在しない。mainとの差が大きく、現状は会員ACL検証に使える完全なschema cloneではない。
rebase_branchはsuccessを返したが、その後のbranch migration listは変化せず、同期完了を確認できなかった。branch statusもCREATING_PROJECTのまま（preview自体はACTIVE_HEALTHY）。
このため会員プロフィールの権限修正テストはHOLD。branch reset/merge/production操作は未実施。

## RLS警告
branch内のpublicテーブル7件（ai_v2_training_rows/models/predictions/trifecta_predictions/daily_rankings/model_evaluations/model_slots）でRLS disabledを検出。これはこのbranchがmainの後続security migrationsを取り込めていないことと整合する。**branch固有の不完全な初期化状態であり、本番の状態を示さない。**
7テーブルのRLSを自動有効化していない。main側では先行読み取り専用監査でpublic通常テーブルRLS未有効0件を確認済み。

## 新規オブジェクトのdefault ACL smoke test
branch上でpostgres roleとしてpublicに一時テーブルを作成し、anon/authenticatedの個別権限を確認後、テーブルをDROPして後片付けした。
- anon/authenticated: SELECT/INSERT/UPDATE/DELETE = false
- anon/authenticated: TRUNCATE = true
このためpostgres grantorのdefault ACLにも、不要なTRUNCATE権限が新規テーブルへ付くことを確認。
新規関数についてはhas_function_privilegeがanon/authenticatedともtrueを返した。PostgreSQLのPUBLIC EXECUTE既定権限が含まれるため、関数権限はPUBLICも含めて検証し、global default privilegesでの処理を別途設計する必要がある。
シーケンスは先のdefault ACL一覧でanon/authenticatedへの付与なしを確認。テストオブジェクトはすべて削除済み。

## 次の対応
1. Supabase branchがmainの全migrationを取り込む仕組み/連携設定を確認。必要なら別の安全なschema-only復元手段を用意。
2. 完全なschemaが再現できるまでACL migrationやmember_profiles testを実行しない。
3. supabase_admin default ACLは権限を推測せず、正式な実行主体とscopeを確定してから試す。
4. すべて隔離環境で検証後に本番適用の別承認を得る。

## 変更履歴
一時テーブル作成・権限照会・DROPのみ。恒久的DDL、GRANT/REVOKE、RLS変更、データ変更、外部通知なし。Productionにはアクセスしていない。
