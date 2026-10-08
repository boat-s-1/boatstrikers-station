# 新聞 前日版自動下書き PHASE 1 — 安全対策と共通処理

対象ブランチ：`feature/newspaper-auto-draft-phase1`。本番DB・Vercel設定・Cronは変更していない。自動下書きの生成処理は未実装（PHASE 2）。

## 公開済み新聞の保護（POST /api/admin/newspapers）

| 既存の行 | 通常の保存 | 結果 |
|---|---|---|
| なし | 新規作成 | 200（従来どおり） |
| draft / archived | 上書き | 200（従来どおり）。保存直前に公開された場合は 409 `published_exists` |
| published | — | **409 `published_exists`**（行は変更しない。`current.updated_at` を返す） |

公開済みを変更する明示的な操作：本文に `confirmPublishedUpdate: true` と、409 で受け取った `expectedUpdatedAt`（= `current.updated_at`）を付けて再送する。管理者Cookie認証は従来どおり必須。

- `updated_at` が一致しない（別の操作で更新済み）場合は 409 `published_stale` で変更しない。
- 公開のまま更新する場合、最初の `published_at` を維持する。
- `status` を draft / archived にすると公開を取り消す（確認ダイアログで明示）。
- 管理画面の新聞パネルは 409 を受けると確認ダイアログを表示し、OK のときだけ上記の形で再送する。

## 候補・予想APIの認証

`/api/admin/{ichika,hatsune,kiina}-news/{candidates,prediction}` は管理者Cookie（`bs_admin_sync`）が無い場合 401 `{ ok: false, error: "unauthorized" }` を返し、DBに接続しない。呼び出し元は `/admin/*-news` 画面（同じCookieでログイン済み）だけ。期限切れ時は画面に再ログインの案内を表示する。

## 共通モジュール（lib/newspaper）

| ファイル | 内容 |
|---|---|
| `predictionSources.mjs` | 候補一覧・予想取得（ランキング、凍結済み公式買い目、初音の艇別データ）と `buildRaceInsights` |
| `aiWriter.mjs` | ai-write のプロンプト作成・OpenAI呼び出し・出力解析（`runNewspaperAiWrite`） |
| `publicationStore.mjs` | 手動保存 `saveNewspaperPublication`、自動下書き用 `insertNewspaperDraftIfAbsent`（既存行を一切更新しない。PHASE 2 で使用） |
| `channels.mjs` | 旧 `lib/newspaperContent.js` の実装（同ファイルから再エクスポート） |

## テスト

```bash
node --test tests/newspaper/*.test.mjs
```

`tests/newspaper/legacy/*.js.txt` は変更前のAPIルートの原本。テストでは原本と新しいルートを同じ偽DB・同じ入力で動かし、応答・DB内容・OpenAIへ送るリクエスト（プロンプト）が一致することを確認する。

`admin-auth.http.test.mjs` は起動中のローカルサーバー向けの任意テスト（`NEWSPAPER_HTTP_BASE_URL` と `NEWSPAPER_HTTP_ADMIN_PASSWORD` が無ければスキップ）。本番URLには向けない。
