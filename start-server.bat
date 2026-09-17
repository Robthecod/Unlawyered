@echo off
title UNLAWYERED server
rem Starts the UNLAWYERED API server (http://127.0.0.1:8787).
rem Uses the dev script (tsx watch) so edits auto-reload.
cd /d "%~dp0"
echo Starting UNLAWYERED server...
call npm run dev:server
echo.
echo Server stopped.
pause
