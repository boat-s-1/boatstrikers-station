@echo off
chcp 65001 > nul
cd /d "%~dp0"
title BoatStrikers ショート動画メーカー

where node > nul 2>&1
if errorlevel 1 (
  echo Node.js が見つかりません。Node.js LTS をインストールしてください。
  echo https://nodejs.org/ja
  pause
  exit /b 1
)

echo BoatStrikers ローカル動画メーカーを起動します。
echo この画面は動画生成中、そのまま開いておいてください。
echo 終了するときは Ctrl+C を押してください。
echo.
node scripts\shorts-local-server.mjs

echo.
echo 動画メーカーが停止しました。
pause
