# 初音ヴィーナスNEWS ローカルMP4レンダラー

Vercel上の管理画面で作ったAI台本を、PC上のAivisSpeechとFFmpegを使ってMP4にします。
AivisSpeechは `127.0.0.1` で動くため、Vercelから直接呼ばずローカルPCでレンダーします。

## 事前準備

- AivisSpeechを起動する
- ffmpeg / ffprobe をPATHに通す
- Node.jsをインストールする
- このリポジトリをPCへ取得する

接続確認:

```powershell
npm run hatsune:render -- --check
```

## 必須設定

PowerShell例:

```powershell
$env:HATSUNE_NEWS_ADMIN_SECRET="VercelのHATSUNE_NEWS_ADMIN_SECRETと同じ値"
$env:HATSUNE_NEWS_SPEAKER_ID="初音に使うAivisSpeechのStyle ID"
$env:HATSUNE_NEWS_BASE_URL="https://www.boat-strike.online"
```

`HATSUNE_NEWS_ADMIN_SECRET` が未設定の場合は、Vercelで既に使っている `CRON_SECRET` と同じ値でも利用できます。

AivisSpeechのStyle IDは次で確認できます。

```powershell
Invoke-RestMethod http://127.0.0.1:10101/speakers | ConvertTo-Json -Depth 8
```

## MP4生成

管理画面 `/admin/hatsune-news/video` の保存済み台本に表示されるIDを使います。

```powershell
npm run hatsune:render -- --id=123
```

Style IDをコマンドで指定する場合:

```powershell
npm run hatsune:render -- --id=123 --speaker=456789
```

出力先は標準で `output/hatsune-news/<ID>/` です。

- MP4
- narration.wav
- captions.ass
- manifest.json
- youtube.txt
- x.txt

が生成されます。成功すると管理画面側の状態も `rendered` に更新されます。

## 初音画像・BGM・SE

画像を指定しない場合はサイト内の `/bsc/status-hatsune.png` を自動取得します。立ち絵へ変更する場合:

```powershell
$env:HATSUNE_NEWS_IMAGE="C:\BoatStrikers\assets\hatsune.png"
$env:HATSUNE_NEWS_BGM="C:\BoatStrikers\assets\venus-news-bgm.mp3"
$env:HATSUNE_NEWS_SE="C:\BoatStrikers\assets\news-opening.mp3"
```

またはコマンド引数でも指定できます。

```powershell
npm run hatsune:render -- --id=123 --image="C:\...\hatsune.png" --bgm="C:\...\bgm.mp3" --se="C:\...\opening.mp3"
```

BGMはナレーションを邪魔しないよう自動で小さくミックスされます。

## 字幕

管理画面でAI生成された `caption_json` を音声尺へ比例配分し、ASS字幕を作ります。音声の実時間はffprobeで取得するため、30/45/60秒ショートだけでなく3〜5分の週間ヴィーナスNEWSにも同じレンダラーを使えます。

## オフライン制作

管理画面の「制作JSON」を保存した場合は、APIへ接続せず次でも生成できます。

```powershell
npm run hatsune:render -- --manifest="C:\...\manifest.json" --speaker=456789
```

この場合、レンダー完了状態の自動同期は行いません。

## デプロイ確認

Phase 2を本番へ反映する際は、`main` の最新コミットでProductionデプロイが `READY` になっていることを確認します。
