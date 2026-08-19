param(
  [Parameter(Mandatory=$true)]
  [string]$DatabaseUrl,
  [string]$OutputDir = ".\backups\boatstrikers-db"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump が見つかりません。PostgreSQL client tools をインストールしてから再実行してください。"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

$tables = @(
  "public.ai_predictions_legacy_v81",
  "public.brdb_race_entries_raw"
)

foreach ($table in $tables) {
  $safeName = $table.Replace("public.", "")
  $file = Join-Path $OutputDir "$safeName-$stamp.dump"

  Write-Host "Backing up $table -> $file"
  & pg_dump `
    --dbname=$DatabaseUrl `
    --format=custom `
    --data-only `
    --table=$table `
    --file=$file

  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed for $table"
  }

  $size = (Get-Item $file).Length
  if ($size -le 0) {
    throw "Backup file is empty: $file"
  }

  Write-Host "OK: $table ($([math]::Round($size / 1MB, 1)) MB dump)"
}

Write-Host ""
Write-Host "Backup completed. Do not delete source tables until both dump files exist and are non-empty."
