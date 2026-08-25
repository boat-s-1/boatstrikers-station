@echo off
setlocal
cd /d "%~dp0"
title BoatStrikers Shorts Maker

where node.exe >nul 2>&1
if errorlevel 1 goto NODE_NOT_FOUND

if not exist "scripts\shorts-local-server.mjs" goto FILE_NOT_FOUND

echo Starting BoatStrikers Shorts Maker...
echo Keep this window open while creating a video.
echo Press Ctrl+C to stop.
echo.
node.exe "scripts\shorts-local-server.mjs"
goto STOPPED

:NODE_NOT_FOUND
echo ERROR: Node.js was not found.
echo Install Node.js LTS from https://nodejs.org/
goto END

:FILE_NOT_FOUND
echo ERROR: scripts\shorts-local-server.mjs was not found.
echo Extract the entire ZIP before running this file.
goto END

:STOPPED
echo.
echo Shorts Maker stopped.

:END
pause
endlocal
