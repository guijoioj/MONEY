@echo off
if "%JWT_SECRET%"=="" set "JWT_SECRET=softHair-dev-jwt-secret-change-me"
if "%JWT_EXPIRES_IN%"=="" set "JWT_EXPIRES_IN=7d"
if "%SOFTHAIR_ROOT_DIR%"=="" set "SOFTHAIR_ROOT_DIR=%APPDATA%\softHair\SoftHair"

cd /d "%~dp0"
echo Starting Backend...
start "Backend" cmd /k "cd backend && set SOFTHAIR_ROOT_DIR=%SOFTHAIR_ROOT_DIR% && set JWT_SECRET=%JWT_SECRET% && set JWT_EXPIRES_IN=%JWT_EXPIRES_IN% && npm run dev"
timeout /t 3
echo Starting Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"
echo.
echo Servers starting:
echo - Backend: http://localhost:3001
echo - Frontend: http://localhost:3000
pause
