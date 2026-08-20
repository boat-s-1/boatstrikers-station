@echo off
setlocal
cd /d "%~dp0\..\.."
echo [BoatStrikers AI v2] previous-day shadow inference
python .\tools\ai-v2\infer-daily.py --timing previous_day
if errorlevel 1 (
  echo.
  echo AI v2 inference failed. See the error above.
  pause
  exit /b 1
)
echo.
echo AI v2 shadow rankings saved successfully.
pause
