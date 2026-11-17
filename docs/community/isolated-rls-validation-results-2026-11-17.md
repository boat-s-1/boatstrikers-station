# 隔離DB RLS実証結果（2026-11-17）

対象：Supabase本番 `rzosrbkyniyedolhkgxo` の新規隔離開発ブランチ `community-rls-isolation-20261117`（project_ref `tqncpfohnylajhjjzlwz`）。時間単価US$0.01344、ユーザー承認後に作成。

## 実施と結果
1. 隔離ブランチ作成成功。ステータス `FUNCTIONS_DEPLOYED`、preview `ACTIVE_HEALTHY`。
2. 隔離DBに `bs_member_profiles` が**存在しない**ことを確認。既存プロフィールの特権列修正をこのブランチで検証することはできなかった。原因は未特定であり、スキーマが完全複製されたとはみなさない。
3. 掲示板レビューSQLと同じ `public.community_threads` スキーマ、index、RLS、public-only SELECT policyを**隔離DBに限り**マイグレーション適用成功。
4. `anon` のSELECT=true、INSERT=false、`authenticated` のUPDATE=false、RLS enabled=true、policy数=1。
5. 5種の投稿（public、members、paid、future public、draft public）をトランザクション内に投入し、`set local role anon` でSELECTすると**公開済みpublicの1件のみ可視**。最後にROLLBACK。
6. 3種の投稿（public、members、paid）をトランザクション内に投入し、`set local role authenticated` でSELECTすると**publicの1件のみ可視**。最後にROLLBACK。
7. `reply_policy` のDB初期値 `disabled` を確認。
8. 検証後に隔離ブランチ削除APIが `success=true`。再度ブランチ一覧を確認し、対象が消えたことを確認。

## 未実施・制限
- 実際のJWT・PostgREST HTTP APIを経由する検証は未実施。SQL `set local role` によるRLS検証と区別する。
- INSERT/UPDATE/DELETEの実際の拒否応答、課金期限・管理者・返信のE2Eは未検証。
- 既存会員プロフィールの権限是正、課金/LINE/マイページの回帰は未実施。
- 本番DBへのDDL/DML、マージ、デプロイは**一切なし**。
- 作成から削除までの請求確定額は未取得。時間単価からの見積もりと実際の請求は別。

## 次の判断
既存会員プロフィールの実証には、隔離ブランチへ該当スキーマを再現する方法を事前に確定する必要がある。検証環境が完全に本番同等でないまま、本番特権列を変更しない。
