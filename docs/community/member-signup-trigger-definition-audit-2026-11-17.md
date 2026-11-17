# 会員登録・プラン変更トリガー実装の読み取り専用監査 — 2026-11-17

## 本番で確認した定義
- `auth.users` の `on_boatstrikers_member_signup` は AFTER INSERT FOR EACH ROWで `public.handle_boatstrikers_member_signup()` を呼ぶ。
- signup関数はpostgres所有 SECURITY DEFINER。 `user_id,email,display_name,plan,membership_status,beta_member,terms_accepted_at,privacy_accepted_at` をINSERTし、plan='beta_premium', membership_status='active', beta_member=trueを設定。
- ON CONFLICT(user_id) DO UPDATE は email, display_name, terms_accepted_at, privacy_accepted_at, updated_at のみ更新。plan/is_adminを変更しない。
- `bs_member_plan_change_log` はプロフィールの AFTER INSERT OR UPDATE OF plan。 `bs_log_member_plan_change()` が `bs_member_plan_events` に旧・新プランを記録する。**権限チェックや変更拒否はしない**。
- `touch_bs_member_profiles_updated_at` は BEFORE UPDATEで updated_atをnow()にする。

## セキュリティ上の帰結
- 自己行UPDATE RLS + authenticated全列UPDATEが組み合わさると、本人行のplanやis_adminなどを更新可能なDB権限構成になる。実HTTP到達性は未確認。
- signupトリガーはSECURITY DEFINERであり、一般会員の直接UPDATE/INSERT権限を制限しても登録を維持できる設計上の可能性がある。ただし実登録回帰試験は未実施。
- signup関数がraw_user_meta_dataのdisplay_name/同意フラグを利用するのは登録データの入力であり、これを課金権限の根拠にしてはならない。
- LINE連携、退会、管理画面、利用規約同意の書き込み経路は依然未特定。列単位権限の本番適用はHOLD。

## 進捗と操作
- 先行コミット3fcd8bfのCommunity security checks run 44101626349 はsuccess。
- 本番SQLはSELECTのみ。PRはDraft、未マージ・未デプロイ。新規有料ブランチなし。
