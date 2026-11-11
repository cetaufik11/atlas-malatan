@echo off
title Atlas Malatan
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum terpasang. Unduh dari https://nodejs.org lalu jalankan file ini lagi.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Memasang paket, tunggu sebentar...
  call npm install
)
echo Membuka Atlas Malatan di browser...
call npm run dev -- --open
pause
