# 本番Security Advisor追加確認：RLS/ACL/関数（2026-11-18）

## 本番の読み取り専用結果
- Supabase Security Advisor: `rls_enabled_no_policy` INFO count=100（一覧は最大100 findings）。RLS有効だがpolicyなしのテーブルが100件検出。
- 独自catalog集計：public通常テーブルでRLS enabled/no policy=100、うちanon/authenticatedのSELECTまたはINSERT ACLを持つもの=51。RLSにpolicyがない場合、通常のRLS対象アクセスは行が許可されない。これは即時のデータ漏えいを意味しないが、不要なACLは撤去候補。
- 別のcatalog集計：public table/partitionのうちanonがTRUNCATE/REFERENCES/TRIGGERを持つもの88、authenticatedは91。
- `bs_member_profiles`もanon/authenticatedのTRUNCATE権限がある。会員テーブルの不要ACL撤去は優先度が高い。
- PostgreSQL TRUNCATEはRLSで制御されない。したがってTRUNCATE ACLはRLS policyの有無とは別に最小化が必要。ただしPostgREST REST APIで任意TRUNCATEを直接発行できることは今回確認していない。実JWT/RESTで実際の到達可能性を検証する必要がある。
- public関数でソースにTRUNCATEを含むものは `bs_refresh_ai_bet_public_stats` 1件。SECURITY DEFINERだがEXECUTE ACLはpostgres/service_roleのみで、anon/authenticatedには実行権限がないことを確認。
- Security Advisorのfunction_search_path_mutable WARN count=11。列挙された関数はSECURITY INVOKER（prosecdef=false）で、anon/authenticated EXECUTEがtrue。主にupdated_at等のtrigger関数。すぐに一括変更せず、呼び出し経路とsearch_path依存を確認する。
- Security Advisorのauth_leaked_password_protection WARN=1。Authの漏えいパスワード保護が無効と検出。これは会員DB ACLとは別のAuth設定課題で、変更は未実施。

## 判定
- ACLの過剰付与は本番で実在する。RLSだけでTRUNCATE権限のリスクを相殺できない。
- ただし現時点でanonからのTRUNCATE実行やデータ消去が成功した証拠はない。Data APIの到達性を含めて実JWT検証が必要。
- 既存テーブルへの一括REVOKEは機能影響が大きいため禁止。内部テーブルはservice_role/cron/functionの依存を確認し、テーブルごとに必要権限を決める。

## 変更していないもの
本番DBへのDDL/DML/GRANT/REVOKE、Auth設定変更、関数変更は一切なし。
