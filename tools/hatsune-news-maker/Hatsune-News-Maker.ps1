$ErrorActionPreference = 'Stop'

$ToolDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ToolDir '..\..')).Path
$ConfigPath = Join-Path $ToolDir 'hatsune-news-maker.env'
$ConfigExamplePath = Join-Path $ToolDir 'hatsune-news-maker.env.example'

function Write-Title {
  Clear-Host
  Write-Host '=============================================='
  Write-Host '  BoatStrikers / 初音ヴィーナスNEWS Maker'
  Write-Host '=============================================='
  Write-Host ''
}

function Require-Command([string]$Name, [string]$Guide) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name が見つかりません。$Guide"
  }
}

function Load-Config {
  if (-not (Test-Path $ConfigPath)) {
    Copy-Item $ConfigExamplePath $ConfigPath
    Write-Host '初回設定ファイルを作成しました。' -ForegroundColor Yellow
    Write-Host $ConfigPath
    Start-Process notepad.exe $ConfigPath
    Write-Host ''
    Write-Host '設定を保存したら、この画面に戻って Enter を押してください。'
    [void](Read-Host)
  }

  Get-Content $ConfigPath -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $parts = $line -split '=', 2
    if ($parts.Count -ne 2) { return }
    $key = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    if ($key) { Set-Item -Path "Env:$key" -Value $value }
  }
}

function Ensure-NodeModules {
  if (-not (Test-Path (Join-Path $RepoRoot 'node_modules'))) {
    Write-Host '初回 npm install を実行します…' -ForegroundColor Cyan
    Push-Location $RepoRoot
    try { npm install } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw 'npm install に失敗しました。' }
  }
}

function Run-Check {
  Write-Host ''
  Write-Host '接続確認中…' -ForegroundColor Cyan
  Push-Location $RepoRoot
  try { npm run hatsune:render -- --check } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { throw '接続確認に失敗しました。AivisSpeech / FFmpeg / ffprobe を確認してください。' }
  Write-Host '接続OKです。' -ForegroundColor Green
}

function Render-Video {
  $id = Read-Host '管理画面の動画IDを入力してください'
  if ($id -notmatch '^\d+$') { throw '動画IDは数字で入力してください。' }

  $args = @('run','hatsune:render','--',"--id=$id")
  if ($env:HATSUNE_NEWS_SPEAKER_ID) { $args += "--speaker=$($env:HATSUNE_NEWS_SPEAKER_ID)" }

  Write-Host ''
  Write-Host "動画ID $id を生成します…" -ForegroundColor Cyan
  Push-Location $RepoRoot
  try { & npm @args } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { throw 'MP4生成に失敗しました。' }

  $output = Join-Path $RepoRoot "output\hatsune-news\$id"
  if (Test-Path $output) {
    Write-Host ''
    Write-Host '完成しました。出力フォルダを開きます。' -ForegroundColor Green
    Start-Process explorer.exe $output
  }
}

Write-Title
Require-Command 'node' 'Node.js LTSをインストールしてください。'
Require-Command 'npm' 'Node.js LTSをインストールしてください。'
Require-Command 'ffmpeg' 'FFmpegをインストールしてPATHを通してください。'
Require-Command 'ffprobe' 'FFmpegをインストールしてPATHを通してください。'
Load-Config
Ensure-NodeModules

while ($true) {
  Write-Title
  Write-Host '1  接続確認'
  Write-Host '2  初音NEWS MP4を生成'
  Write-Host '3  設定ファイルを開く'
  Write-Host '4  出力フォルダを開く'
  Write-Host '0  終了'
  Write-Host ''
  $choice = Read-Host '番号を選んでください'

  switch ($choice) {
    '1' { Run-Check; Write-Host ''; [void](Read-Host 'Enterでメニューへ戻る') }
    '2' { Run-Check; Render-Video; Write-Host ''; [void](Read-Host 'Enterでメニューへ戻る') }
    '3' { Start-Process notepad.exe $ConfigPath }
    '4' {
      $root = Join-Path $RepoRoot 'output\hatsune-news'
      if (-not (Test-Path $root)) { New-Item -ItemType Directory -Force -Path $root | Out-Null }
      Start-Process explorer.exe $root
    }
    '0' { exit 0 }
    default { Write-Host '0〜4の番号を選んでください。' -ForegroundColor Yellow; Start-Sleep -Seconds 1 }
  }
}
