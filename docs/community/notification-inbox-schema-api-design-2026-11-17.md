# 通知受信箱DB設計（未適用） — 2026-11-17

**状態：設計レビュー用。SQLを本番・隔離DBに実行していない。**

## 目的と境界
単一BoatStrikers会員IDを利用し、サイト内受信箱を通知の正本とする。LINE/Discordは既存の任意チャネルとして維持し、将来PWA/ネイティブPushへ拡張する。通知はサーバー側だけが生成し、クライアントは自分の通知の取得・既読・設定変更のみ。

## 候補テーブル（名称は暫定）
- `bs_notifications`: id uuid PK, recipient_user_id uuid NOT NULL, event_type text CHECK(4種), dedupe_key text NOT NULL, title text, safe_summary text, target_kind text, target_id text, created_at timestamptz, read_at timestamptz, deleted_at timestamptz。 `UNIQUE(recipient_user_id,dedupe_key)`。表示する前に対象コンテンツの現在の公開状態をサーバーで再評価。
- `bs_notification_preferences`: user_id uuid, event_type text, channel text CHECK(in_app/web_push/native_push), enabled boolean, updated_at timestamptz, PRIMARY KEY(user_id,event_type,channel)。in_appは基本受信箱として扱い、プッシュは明示オプトイン。
- `bs_push_subscriptions`: id uuid PK, user_id uuid NOT NULL, channel text, endpoint_hash text UNIQUE, endpoint_ciphertext/keys_ciphertext or provider token encrypted, created_at/last_seen_at/revoked_at timestamptz。端末購読情報は秘密扱い。保存暗号化・鍵管理は実装前に確定。
- `bs_notification_deliveries`: id uuid PK, notification_id uuid, channel, attempt, status, attempted_at, error_code。ログには購読URL/鍵/機微本文を保存しない。再試行は上限・指数バックオフ・重複排除を適用。

## RLS/権限（実装前の要求）
1. 全テーブルでRLSを有効化し、schema/table grantsは必要なものに限定。anonには原則アクセスさせない。
2. `bs_notifications` のSELECTは本人だけ。INSERT/DELETE/UPDATEは原則サーバー限定。既読更新は所有者と変更可能列を限定した安全なRPCまたは専用APIで行い、他列の変更を拒否する。
3. `bs_notification_preferences` は本人のみSELECT/変更可能。サーバー側でチャネルの妥当性と同意を検証する。
4. `bs_push_subscriptions` は原則サーバー経由で登録・解除。本人確認、購読所有権、重複/失効を管理。クライアントから他人のトークンは見えない。
5. `bs_notification_deliveries` はサーバー限定。サービスロールキーをブラウザへ渡さない。
6. SECURITY DEFINERの関数は必要最小限とし、固定search_path、EXECUTE権限の限定、本人IDチェック、監査を必須とする。
7. 通知の`authorized_by_server`等のフラグはクライアント申告を信用せず、サーバー検証結果としてのみ扱う。

## API契約（暫定）
- GET /api/notifications?cursor=... : 認証必須、最大50件、受信者IDはセッションから取得。各通知の現在の閲覧権限を検証して返す。
- POST /api/notifications/:id/read : 認証必須、対象IDの所有権確認、既読日時のみ更新、冪等。
- GET/PATCH /api/notification-preferences : 認証必須、本人のイベント種別/チャネル設定のみ。
- POST/DELETE /api/push-subscriptions : 認証必須、端末登録・解除、CSRF/リプレイ/失効対策。
- イベント発行は非公開サーバー経路のみ。送信前にも閲覧権限・配信同意・退会状態を再確認。

## 保留事項
- 通知保持期間、削除要求、Web Push送信基盤、VAPID鍵、既存Discord/LINE依存先、既存課金正本、既存DB migrationとの整合性。
- 本番の既存`bs_member_profiles`/`bs_member_line_link_codes`の過剰GRANTを解消してから実データ連携。
- 将来アプリのAPNs/FCM、アプリストア課金、端末トークン管理は別段階。

## 受け入れ条件
- 他人の通知の閲覧・既読・作成が不可、未認可の有料情報が露出しない。
- 同一イベントの二重発行が冪等で、プッシュ解除後は配信しない。
- 通知配信失敗時もサイト内受信箱は維持。
- 既存LINE/Discordを止めずに切替可能。
- 本番操作前に独立環境の実RLS/APIテスト、レビュー、明示承認を得る。
