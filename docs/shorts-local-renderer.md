# BoatStrikers ショート動画ローカル生成

`/admin/shorts`から、Windowsパソコン上の公式ナレーター音声と9:16 MP4を生成します。通常の操作にPowerShellは不要です。

## 必要なもの

1. Node.js 20以上
2. FFmpeg（`ffmpeg`と`ffprobe`にPATHが通っていること）
3. AivisSpeechを起動

## 最初の準備

1. このプロジェクトをWindowsパソコンに保存します。
2. Node.js LTSとFFmpegをインストールします。
3. AivisSpeechを起動します。
4. プロジェクト直下の`start-shorts-maker.bat`をダブルクリックします。
5. 「準備完了」と表示された黒い画面は、そのまま開いておきます。

## 管理画面から生成

1. `/admin/shorts`を開き、TOP3と原稿を確認します。
2. 「接続を再確認」を押します。
3. ローカル動画メーカー、AivisSpeech、FFmpegの3項目が緑色になったことを確認します。
4. 必要なら「公式ナレーターを試聴」を押します。
5. 「このPCでMP4を生成」を押します。
6. 完成後に「保存フォルダを開く」を押します。

Chromeからローカルネットワークへのアクセス許可を求められた場合は「許可」を選択してください。ローカル動画メーカーは`127.0.0.1`だけで待ち受けるため、同じパソコン以外からは接続できません。

完成ファイルは`output/shorts/対象日/`に保存されます。

- `narration.wav`
- `captions.ass`
- `ichika-top3-対象日.mp4`
- `post.txt`

## 生成に失敗した場合

FFmpegの詳細は起動中の黒い画面と管理画面に表示され、全ログは`output/logs/`にも保存されます。管理画面に表示されたログファイルの場所を開くと、省略されていないエラーを確認できます。

動画は一時ファイルへ書き出してから完成ファイルへ切り替えます。同名MP4を動画プレイヤーやエクスプローラーのプレビューで開いている場合は、保存時に分かりやすい案内を表示し、既存MP4を途中生成データで壊さないようにしています。

## 音声設定

標準の公式ナレーターは、AivisSpeechの「まお／おちつき」（スタイルID `888753763`）です。管理画面にはこのIDが初期設定されています。

- AivisSpeech: `http://127.0.0.1:10101/speakers`
- VOICEVOX: `http://127.0.0.1:50021/speakers`

一時的に接続先やIDを変更する場合は、`BS_TTS_ENDPOINT`と`BS_TTS_SPEAKER_ID`を使えます。

## コマンドで生成する場合（予備手段）

```powershell
npm install
npm run shorts:render -- "C:\Users\user\Downloads\ichika-short-2026-08-23.json"
npm run shorts:render -- --check
```
