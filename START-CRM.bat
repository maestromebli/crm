@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "package.json" (
  echo Помилка: запускайте START-CRM.bat з папки проєкту ^(де є package.json^).
  pause
  exit /b 1
)

echo.
echo  Відкриваю ОКРЕМЕ вікно з сервером...
echo  Його НЕ ЗАКРИВАТИ, поки працюєте в CRM.
echo.

start "ENVER CRM — сервер" cmd /k "%~dp0scripts\run-dev-server.cmd"

echo  Чекаю 20 секунд, потім відкрию браузер...
echo  Якщо браузер відкрився занадто рано — дочекайтесь у вікні сервера рядка "Ready".
echo.
timeout /t 20 /nobreak >nul

start "" "http://localhost:3000/login"

echo.
echo  Готово. Якщо знову "відмова в з'єднанні":
echo   1^) Подивіться вікно "ENVER CRM — сервер" — чи є там помилка червоним.
echo   2^) Дочекайтесь "Ready" і натисніть оновити в браузері.
echo   3^) У терміналі Cursor виконайте: pnpm diagnose
echo.
pause
