# BoatStrikers Discord PREMIUM セットアップ

## 目的

- LINE公式: 重要通知のみ（1日最大3〜5通を目標）
- Discord: 有料会員限定の全成立アラート
- BoatStrikers: 会員判定・Discord連携・権限同期・通知履歴の母艦

## Discordサーバー構成

### ロール

1. `BSC BOT`
2. `BSC PREMIUM`
3. `@everyone`

重要: Discordの「サーバー設定 → ロール」で `BSC BOT` を `BSC PREMIUM` より上に置くこと。

`BSC BOT` に必要な権限:

- View Channels
- Send Messages
- Manage Roles
- Create Instant Invite

Administrator は不要。

### カテゴリ / チャンネル

- `00｜START`
  - `#welcome`
  - `#使い方`
  - `#お知らせ`
- `10｜PREMIUM通知`
  - `#全アラート`
  - `#一果-イン逃げ速報`
  - `#初音-女子戦速報`
  - `#キイナ-穴狙い速報`
- `20｜DATA LAB`
  - `#結果検証`
  - `#data-lab`

PREMIUM通知カテゴリは `@everyone` の View Channel を拒否し、`BSC PREMIUM` の View Channel を許可する。

## Discord Developer Portal

1. New Application で `BoatStrikers` を作成
2. Bot を作成
3. Bot をBoatStrikersサーバーへ追加
4. OAuth2 Redirects に以下を登録

`https://www.boat-strike.online/api/members/discord/callback`

会員連携では `identify guilds.join` を利用する。

## Vercel 環境変数

Production に以下を登録する。

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_PREMIUM_ROLE_ID`
- `DISCORD_ALL_ALERTS_CHANNEL_ID`
- `DISCORD_ICHIKA_CHANNEL_ID`
- `DISCORD_HATSUNE_CHANNEL_ID`
- `DISCORD_KIINA_CHANNEL_ID`
- `DISCORD_REDIRECT_URI=https://www.boat-strike.online/api/members/discord/callback`

Client Secret / Bot Token は公開コード、NEXT_PUBLIC環境変数、ブラウザ側へ絶対に置かない。

## IDの取得方法

Discordの設定 → 詳細設定 → 開発者モードをON。
その後、サーバー/ロール/チャンネルを長押しまたは右クリックして「IDをコピー」。

## 会員導線

サイト:

`https://www.boat-strike.online/members/discord`

LINEリッチメニュー:

- 表示文言: `有料会員限定 全通知` / `Discord 全通知`
- URI: `https://www.boat-strike.online/members/discord`

LINEからDiscordの生招待URLへ直接飛ばさない。必ずBoatStrikers会員ページを経由させ、会員資格を確認してからDiscordへ参加させる。

## 自動処理

- `/api/cron/discord-alerts`: 2分おきに全成立アラートをDiscordへ配信
- `/api/cron/discord-membership-sync`: 15分おきにBoatStrikers会員状態とDiscord PREMIUMロールを同期
- 対象プラン: `beta_premium`, `plus`, `premium`
- `membership_status != active` または対象外プランになった場合、PREMIUMロールを自動削除

## 運用

Discordサーバーから退会させるのではなく、PREMIUMロールだけを外す。無料化したユーザーには `#welcome` と `#お知らせ` だけを残す構成を推奨する。
