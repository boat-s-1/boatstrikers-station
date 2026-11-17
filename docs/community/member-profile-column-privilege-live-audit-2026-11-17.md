# 会員プロフィールの列単位UPDATE権限監査（2026-11-17）

## 読み取り専用SQLの実測
対象：本番 `rzosrbkyniyedolhkgxo`、`public.bs_member_profiles`。実データ行を取得せず、information_schema.column_privileges、information_schema.triggers、pg_procのみSELECT。

- `anon` と `authenticated` の**双方**について、16列すべてにUPDATE権限が表示された。列には `plan`, `membership_status`, `beta_member`, `premium_until`, `is_admin`, `user_id`, `withdrawn_at` を含む。
- RLSは有効で、SELECT/UPDATEは `auth.uid()=user_id` の本人行限定ポリシー。RLSは列の更新可否を制御しない。
- プロフィールのUPDATE BEFORE trigger `touch_bs_member_profiles_updated_at` はupdated_atをnow()に変更するのみ。権限保護はない。
- INSERT/UPDATE AFTER trigger `bs_member_plan_change_log` はプラン変更を `bs_member_plan_events` に記録するのみ。プラン変更の承認・拒否はしない。関数はSECURITY DEFINER。
- 匿名ロールにはRLSのUPDATE policyがないため匿名ユーザーが更新できると断定はしない。ただし過剰ACLは是正対象。

## 判断
**課金/管理者フラグの自己更新リスクは具体的に確認できた。** 実JWT/APIでの悪用可否は未検証であり、実際に改ざんが発生したとの証拠ではない。

## 安全な是正案（未実行）
1. アプリ側で更新している列とAuth signup/LINE連携/決済/退会処理を棚卸し。
2. 隔離DBで `REVOKE UPDATE ON public.bs_member_profiles FROM anon,authenticated` などの最小権限案を検証し、ユーザーが変更できる必要がある列だけ列単位GRANTを再設定。全列UPDATEを残したまま列単位GRANTを追加しても保護にならない。
3. `DELETE`, `TRUNCATE`, `INSERT` などの過剰ACLと既存RLS、signup trigger、plan event loggerへの影響も検証。
4. 会員A/B・匿名の実JWT/RESTで権限拒否と正規更新を確認し、ロールバック計画を用意。
5. 変更の本番適用は影響確認と明示承認後。

本番DBへの更新・権限変更は実施していない。
