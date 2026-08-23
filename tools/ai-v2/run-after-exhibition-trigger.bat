@echo off
setlocal
cd /d "%~dp0\..\.."
python .\tools\ai-v2\watch-after-exhibition.py
exit /b %errorlevel%
