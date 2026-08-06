@echo off
setlocal enabledelayedexpansion

set ROOT=%~dp0
cd /d "%ROOT%"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm не найден
  exit /b 1
)

where curl >nul 2>nul
if errorlevel 1 (
  echo curl не найден
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=New-Object Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1',5432); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo PostgreSQL не отвечает на 127.0.0.1:5432
  echo Запустите базу и повторите запуск
  exit /b 1
)

if not exist ".runtime" mkdir .runtime

echo Запуск backend...
start "pickme-backend" cmd /c "cd /d backend && npm run start:dev > ..\.runtime\backend.log 2>&1"

echo Ожидание health backend...
set BACKEND_OK=0
for /l %%i in (1,1,90) do (
  curl -fsS http://127.0.0.1:3000/health >nul 2>nul && set BACKEND_OK=1 && goto :backend_ready
  timeout /t 1 >nul
)
:backend_ready
if "%BACKEND_OK%"=="0" (
  echo Backend health-check не прошел. См. .runtime\backend.log
  exit /b 1
)

echo Запуск frontend...
start "pickme-frontend" cmd /c "cd /d frontend && npm run dev -- --host 0.0.0.0 --port 5174 > ..\.runtime\frontend.log 2>&1"

echo Ожидание health frontend...
set FRONTEND_OK=0
for /l %%i in (1,1,90) do (
  curl -fsS http://127.0.0.1:5174 >nul 2>nul && set FRONTEND_OK=1 && goto :frontend_ready
  timeout /t 1 >nul
)
:frontend_ready
if "%FRONTEND_OK%"=="0" (
  echo Frontend health-check не прошел. См. .runtime\frontend.log
  exit /b 1
)

echo PickMe запущен: http://127.0.0.1:5174
start "" http://127.0.0.1:5174
echo Логи: .runtime\backend.log и .runtime\frontend.log
exit /b 0
