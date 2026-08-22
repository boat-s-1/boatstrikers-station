# BoatStrikers ショート動画ローカル生成

`/admin/shorts`で保存したJSONから、公式ナレーター音声と9:16 MP4を生成します。

## 必要なもの

1. Node.js 20以上
2. FFmpeg（`ffmpeg`と`ffprobe`にPATHが通っていること）
3. AivisSpeechまたはVOICEVOXを起動

## 生成手順

```powershell
npm install
npm run shorts:render -- "C:\Users\user\Downloads\ichika-short-2026-08-23.json"
```

完成ファイルは`output/shorts/対象日/`に保存されます。

- `narration.wav`
- `captions.ass`
- `ichika-top3-対象日.mp4`
- `post.txt`

## 音声設定

標準の公式ナレーターは、AivisSpeechの「まお／おちつき」（スタイルID `888753763`）です。管理画面にはこのIDが初期設定されています。

- AivisSpeech: `http://127.0.0.1:10101/speakers`
- VOICEVOX: `http://127.0.0.1:50021/speakers`

一時的に接続先やIDを変更する場合は、`BS_TTS_ENDPOINT`と`BS_TTS_SPEAKER_ID`を使えます。

## 動作確認

```powershell
npm run shorts:render -- --check
```
