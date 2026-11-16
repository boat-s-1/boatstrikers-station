# AI司令塔 v0.24 隔離ブランチ検証メモ

- 対象: codex/agent-controller-offline-v24-20261117
- 目的: Windows不要のGitHub Actions実行検証
- 制約: TRINITY API取得、Cron再起動、本番DB書込、Vercel操作は禁止
- 導入予定: `tools/agent-controller/` と `.github/workflows/agent-controller-offline-dashboard.yml`
- 現状: ZIPで用意したコード一式はまだこのブランチに配置していません。
- 注意: GitHubの `workflow_dispatch` は原則、ワークフローファイルがデフォルトブランチに存在する必要があります。隔離ブランチに追加しただけでは手動実行を保証できません。
- 次工程: コードの完全配置、静的検査、手動実行可能な安全な経路の確認。既存のTRINITYワークフローは変更しません。
