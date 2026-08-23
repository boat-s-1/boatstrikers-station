@echo off
setlocal
set "TASK_NAME=BoatStrikers AI V2 Live Trigger"
set "RUNNER=%~dp0run-after-exhibition-trigger.bat"

if not exist "%RUNNER%" (
  echo Runner not found: %RUNNER%
  pause
  exit /b 1
)

echo Installing scheduled task: %TASK_NAME%
schtasks /Create /F /TN "%TASK_NAME%" /SC MINUTE /MO 1 /ST 00:00 /TR "\"%RUNNER%\""
if errorlevel 1 (
  echo.
  echo Failed to create scheduled task. Run this file as Administrator and try again.
  pause
  exit /b 1
)

echo.
echo Installed successfully.
echo The watcher checks every minute, but LightGBM only runs when new exhibition data is detected.
echo Active live window inside the watcher: 07:00-22:30 JST.
echo.
schtasks /Run /TN "%TASK_NAME%" >nul 2>&1
pause
