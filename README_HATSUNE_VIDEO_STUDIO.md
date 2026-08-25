# 初音ヴィーナスNEWS 制作（Phase 1）

管理画面 `/admin/hatsune-news/video` から、保存済みの `hatsune_news` を元に動画台本をAI生成し、`hatsune_news_videos` に保存します。

## 対応モード

- 今日のショート: 30 / 45 / 60秒
- 週間ヴィーナスNEWS: 3〜5分想定

## AI生成物

- 読み上げ台本
- 字幕短文
- YouTubeタイトル
- YouTube概要欄
- X投稿文
- ハッシュタグ

## セキュリティ

- 管理画面・生成APIは既存の管理Cookie認証を使用
- `hatsune_news_videos` はRLS有効・公開ポリシーなし
- DBアクセスはサーバー側のService Roleのみ

## Phase 2候補

AivisSpeech音声生成、字幕タイムライン、サムネイル素材、ffmpegによるMP4生成を接続する。
