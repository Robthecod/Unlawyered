@echo off
title UNLAWYERED - starting servers
rem One double-click to start both UNLAWYERED servers:
rem   - API server on http://127.0.0.1:8787
rem   - Web app  on http://127.0.0.1:5173
rem Each runs in its own window; close a window to stop that server.
cd /d "%~dp0"

echo Starting UNLAWYERED API server (port 8787)...
start "UNLAWYERED server" cmd /k "npm run dev:server"

echo Starting UNLAWYERED web app (port 5173)...
start "UNLAWYERED web" cmd /k "npm run dev:web"

rem Give Vite a moment, then open the app in the default browser.
timeout /t 5 /nobreak >nul
start "" http://localhost:5173

echo.
echo Both servers started. The app should open in your browser.
echo Leave the two server windows open; closing one stops that server.
pause
