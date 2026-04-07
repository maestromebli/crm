@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
title ENVER CRM — сервер (не закривати)

echo.
echo  ========================================
echo   ENVER CRM — локальний dev-сервер
echo  ========================================
echo   У браузері: http://localhost:3000/login
echo   Це вікно має лишатися відкритим.
echo  ========================================
echo.

if not exist "package.json" (
  echo Помилка: package.json не знайдено.
  pause
  exit /b 1
)

node scripts\dev-unlock.mjs 2>nul

where pnpm >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Запуск: pnpm dev ...
  echo.
  pnpm dev
  goto :end
)

where npm >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Запуск: npm run dev ...
  echo.
  npm run dev
  goto :end
)

where npx >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Запуск: npx next dev ...
  echo.
  npx next dev --webpack -p 3000
  goto :end
)

echo [ПОМИЛКА] Не знайдено Node.js ^(pnpm / npm / npx^).
echo Встановіть: https://nodejs.org
echo Потім: npm install -g pnpm
echo І в цій папці: pnpm install
pause
exit /b 1

:end
echo.
echo Сервер зупинено.
pause
