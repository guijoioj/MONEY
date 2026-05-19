@echo off
setlocal
set "SOFTHAIR_ROOT_DIR=%APPDATA%\softHair\SoftHair"
if "%JWT_SECRET%"=="" set "JWT_SECRET=softHair-dev-jwt-secret-change-me"
if "%JWT_EXPIRES_IN%"=="" set "JWT_EXPIRES_IN=7d"
if "%SOFTHAIR_DEFAULT_ADMIN_EMAIL%"=="" set "SOFTHAIR_DEFAULT_ADMIN_EMAIL=admin@salao.com"
if "%SOFTHAIR_DEFAULT_ADMIN_PASSWORD%"=="" set "SOFTHAIR_DEFAULT_ADMIN_PASSWORD=TROQUE_NA_PRIMEIRA_LOGIN"

title SoftHair - Sistema de Gestao de Salao
echo ========================================
echo    SOFTHAIR
echo    Sistema de Gestao de Salao
echo ========================================
echo.

REM Verificar Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Node.js NAO ESTA INSTALADO
    echo Execute instalar.bat primeiro
    pause
    exit /b 1
)

cd /d "%~dp0"

if not exist "%SOFTHAIR_ROOT_DIR%\data" mkdir "%SOFTHAIR_ROOT_DIR%\data"

set "SOFTHAIR_ENV=SOFTHAIR_ROOT_DIR=%SOFTHAIR_ROOT_DIR% JWT_SECRET=%JWT_SECRET% JWT_EXPIRES_IN=%JWT_EXPIRES_IN% SOFTHAIR_DEFAULT_ADMIN_EMAIL=%SOFTHAIR_DEFAULT_ADMIN_EMAIL% SOFTHAIR_DEFAULT_ADMIN_PASSWORD=%SOFTHAIR_DEFAULT_ADMIN_PASSWORD%"

if "%SOFTHAIR_DEFAULT_ADMIN_EMAIL%"=="" set SOFTHAIR_DEFAULT_ADMIN_EMAIL=admin@salao.com
if "%SOFTHAIR_DEFAULT_ADMIN_PASSWORD%"=="" set SOFTHAIR_DEFAULT_ADMIN_PASSWORD=TROQUE_NA_PRIMEIRA_LOGIN

cd /d "%~dp0backend"
if exist node_modules (
  echo.
) else (
  npm install >nul 2>&1
)

%SOFTHAIR_ENV% node src\scripts\createAdmin.js

cd /d "%~dp0"

echo Iniciando Backend...
start "Backend" /D "backend" cmd /c "%SOFTHAIR_ENV% node src\server.js > \"%~dp0backend.log\" 2>&1"

timeout /t 3 /nobreak >nul

echo Iniciando Frontend...
start "Frontend" /D "frontend" cmd /c "npm run dev > \"%~dp0frontend.log\" 2>&1"

echo.
echo ========================================
echo SoftHair Iniciando...
echo ========================================
echo.
echo Acesse no navegador: http://localhost:3000
echo.
echo IMPORTANTE: Mantenha ambas as janelas abertas
echo.
timeout /t 5 /nobreak >nul
echo Sistema pronto para uso!
