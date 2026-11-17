# BoatStrikers 3分類・掲示板 実装設計（2026-11-17）

## 状態と安全境界
設計のみ。既存の本番DB・本番サイト・Cron・会員情報は変更しない。別PRの変更を取り込まず、実装時は差分を限定する。

## ナビゲーション
第一階層を「レース / ブログ / 掲示板」の3分類にする。既存URLは変更せず、掲示板の新規入口を `/community` とする。既存のトップ・キャラクターページは掲示板投稿の最新3〜5件を表示するだけで、投稿本文の編集・保存は掲示板側に集約する。最新表示は「公開可能な公式スレッド」に限定し、会員限定本文や返信を公開キャッシュへ混ぜない。

## URL案
- `/community`: 掲示板トップ。新着・実況中・カテゴリ別一覧
- `/community/ichika`, `/community/hatsune`, `/community/kiina`: キャラ別一覧
- `/community/race`: 実況一覧
- `/community/t/[slug]`: 公開スレッドの固有URL
- `/community/events/[event-slug]`: 1開催12Rの親ページ。レース別12スレッドへリンク

## 権限と公開区分
- 公式・管理者のみスレッド作成・編集・公開・非公開・返信ロック
- 初期版は会員が公式スレッドにのみ返信可能。会員同士の返信はDB構造上のみ将来対応（parent_reply_idは初期版で常にNULLを強制）
- visibility = public_all / public_post_members_replies / members_only
- 返信できるのは認証済みかつ有効な対象プランの会員。対象プランの最終判定は既存の会員権限ロジックと一致させる。UI非表示だけで制御しない
- 公開スレッドのSEO HTMLには公開可能な本文のみ含める。会員限定の返信や本文はサーバー・DBで拒否する
- 非公開、削除、BAN、退会、プラン失効時の再検証。Realtimeチャンネルからの漏えいを防ぐ

## データモデル（案、未適用）
- community_categories: id, slug, name, sort_order, active
- community_threads: id, slug, category_id, character_key, event_key, race_no, title, excerpt, body, visibility, status, is_locked, published_at, updated_at, last_official_activity_at, created_by
- community_replies: id, thread_id, author_id, parent_reply_id NULL, body, status, created_at, edited_at
- community_moderation_logs: id, actor_id, target_type, target_id, action, reason, created_at
- community_report_queue: id, reporter_id, reply_id, reason, status, created_at
- インデックス: (status, published_at DESC), (character_key, published_at DESC), (event_key, race_no), (thread_id, created_at)
- 1イベント12Rの作成は一意キー (event_key, race_no) と再実行安全性を確保。重複開催・欠番・キャンセルの運用も考慮
- 既存 blog_posts は直接流用せず、必要時にコミュニティスレッドを参照して編集済みブログ下書きを生成

## トップとキャラページ
- トップ: 掲示板新着5件、各キャラ: 該当キャラの新着3件
- 表示: キャラ、カテゴリ、タイトル、公式更新時刻、公開可能な短い要約、返信数（公開範囲に応じた数）
- 返信による一覧の過度な上位固定を防ぎ、基本は公式の更新時刻でソート
- 「掲示板をもっと見る」から各一覧へ。スマホの読みやすさと既存のナビを維持

## 検索流入
- 公開スレッドは固有URL、SSR/SSG、canonical、title、description、sitemap、構造化データを検討
- 薄い投稿、重複、会員限定、削除、未公開はnoindex。検索流入は保証しない
- X/YouTube/noteには公開スレッドのリンクを共有。投稿自動生成は下書き→人間承認

## セキュリティのブロッカー
2026-11-17の読み取り専用調査では public.bs_member_profiles に「自分の行を更新できる」UPDATE RLSポリシーがあり、authenticatedにplan/membership_status/premium_until/is_adminのUPDATE列権限が存在した。実際の悪用可否は未検証。既存の会員編集経路を調べた上で、隔離環境で権限カラムの変更拒否と表示名更新成功をテストする。本番の権限変更は別途明示的な承認後に限定。

## 段階的実装
1. GitHub既存ページ/認証/課金ロジックの特定、PR競合確認
2. 隔離環境で会員権限の負例・正例テスト
3. 掲示板DB + RLS + API（公開/有料/管理者）を隔離環境に実装
4. 掲示板トップ、カテゴリ、スレッド、公式管理画面、返信・通報
5. トップとキャラページに最新投稿、12R実況、Realtime更新
6. SEO/OGP/構造化データ、性能、スパム対策、スマホ、退会/失効/削除試験
7. PRレビュー→ステージング→明示的承認後に本番反映

## 受入条件
- 非ログインで公開スレッド閲覧可、会員限定データはAPI/HTML/Realtimeとも不可
- 無料会員の有料返信作成は403相当。失効後も不可
- 一般会員は公式スレッド作成・編集・削除不可
- 会員同士の返信は初期版でDBレベルでも不可
- キャラ別最新表示が正しく絞り込まれ、限定本文を漏らさない
- 12Rを繰り返し作成しても重複なし
- 投稿非公開・削除後にキャッシュや検索用データが残留しない
- 既存レース/ブログ/会員導線に回帰なし

## 確認事項
- 既存サイトの実際のルーティング構造・各キャラページのパス（GitHub default branchのコード検索で特定できず）
- プランごとの返信資格（beta_premium/plus/premium）
- 公開スレッドに返信本文まで一般公開するかの既定値
- モデレーションの運用担当・投稿頻度・自動投稿の承認フロー

## 調査の根拠
- GitHub: `boat-s-1/boatstrikers-station` の `package.json` にNext.js/React/@supabase/supabase-js
- Supabase本番: `bs_member_profiles` の列/RLS/列権限、`blog_posts`、`blog_authors`、community/forum/thread系の既存publicテーブルが見つからないこと
- 本書は実装済みを意味しない
