# 初音ヴィーナスNEWS Maker — 別PCセットアップ

このフォルダは、管理画面で作成した「今日のショート」「週間ヴィーナスNEWS」の台本を、別のWindows PCでAivisSpeech + FFmpegを使ってMP4化するためのセットアップ一式です。

## 1. 別PCに入れるもの

- Node.js LTS
- Git
- FFmpeg（ffmpeg / ffprobe がコマンドで使える状態）
- AivisSpeech

AivisSpeechは動画作成時に起動しておいてください。

## 2. BoatStrikersを取得

任意のフォルダで次を実行します。

```powershell
git clone https://github.com/boat-s-1/boatstrikers-station.git
cd boatstrikers-station
npm install
```

すでに取得済みなら、作業前に次を実行してください。

```powershell
git pull
```

## 3. 初回設定

`tools\hatsune-news-maker\Hatsune-News-Maker.bat` をダブルクリックします。

初回は自動的に `hatsune-news-maker.env` が作られ、メモ帳で開きます。次の3項目を設定してください。

```text
HATSUNE_NEWS_BASE_URL=https://www.boat-strike.online
HATSUNE_NEWS_ADMIN_SECRET=Vercelと同じ管理用Secret
HATSUNE_NEWS_SPEAKER_ID=初音に使うAivisSpeech Style ID
```

SecretはこのPCだけに保存し、GitHubへコミットしないでください。このフォルダでは `hatsune-news-maker.env` を `.gitignore` 対象にしています。

## 4. AivisSpeech Style IDの確認

AivisSpeechを起動した状態でPowerShellから実行します。

```powershell
Invoke-RestMethod http://127.0.0.1:10101/speakers | ConvertTo-Json -Depth 8
```

初音として使う音声の `styles.id` を `HATSUNE_NEWS_SPEAKER_ID` に設定します。

## 5. 動画作成

1. Webの管理画面 `/admin/hatsune-news/video` で台本を作成します。
2. 保存された動画IDを確認します。
3. 別PCで `Hatsune-News-Maker.bat` をダブルクリックします。
4. `2 初音NEWS MP4を生成` を選びます。
5. 動画IDを入力します。

Makerは先にFFmpeg / ffprobe / AivisSpeechの接続確認を行い、問題なければ本番APIから制作JSONを取得してMP4を生成します。

完成ファイルは標準で次に出ます。

```text
output\hatsune-news\<動画ID>\
```

主な生成物:

- MP4
- narration.wav
- captions.ass
- manifest.json
- youtube.txt
- x.txt

完了すると出力フォルダが自動で開き、Web管理画面側の状態も `rendered` に更新されます。

## 6. Makerメニュー

- `1 接続確認` — ffmpeg / ffprobe / AivisSpeechを確認
- `2 初音NEWS MP4を生成` — 動画IDからMP4生成
- `3 設定ファイルを開く` — Secret・Style IDなどを編集
- `4 出力フォルダを開く` — 完成動画フォルダを表示
- `0 終了`

## 7. 立ち絵・BGM・SEを変える

設定ファイルにローカルパスを追加できます。

```text
HATSUNE_NEWS_IMAGE=C:\BoatStrikers\assets\hatsune.png
HATSUNE_NEWS_BGM=C:\BoatStrikers\assets\venus-news-bgm.mp3
HATSUNE_NEWS_SE=C:\BoatStrikers\assets\news-opening.mp3
```

未指定の場合、初音画像はサイト側の既定画像を自動取得します。

## 8. よくあるエラー

### `node` または `npm` が見つからない
Node.js LTSをインストールしてPCを再起動してください。

### `ffmpeg` / `ffprobe` が見つからない
FFmpegの `bin` フォルダをWindowsのPATHへ追加してください。

### AivisSpeechへ接続できない
AivisSpeechが起動しているか、`http://127.0.0.1:10101` が使えるか確認してください。

### 401 / 403
`HATSUNE_NEWS_ADMIN_SECRET` がVercel側のSecretと同じか確認してください。

### Style IDエラー
AivisSpeechのspeaker一覧を再取得し、正しい `styles.id` を設定してください。

## 運用のおすすめ

別PCでは毎回、作業前に `git pull` を行い、その後 `Hatsune-News-Maker.bat` を起動してください。Web側の台本とローカル動画生成を分離しているため、制作担当PCを変更しても同じ手順で運用できます。
