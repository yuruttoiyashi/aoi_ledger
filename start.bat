@echo off
setlocal
cd /d "%~dp0"
start "" http://localhost:4173
npm run dev
if errorlevel 1 (
  echo.
  echo 起動に失敗しました。Node.js / npm が利用できるか確認してください。
  pause
)
