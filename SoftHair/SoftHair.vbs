@echo off
title SoftHair - Sistema de Gestao de Salao
echo ========================================
echo    SOFTHAIR v2.2.0
echo    Sistema de Gestao de Salao
echo ========================================
echo.

REM Verificar Node.js
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Node.js NAO ESTA INSTALADO
    echo.
    echo Por favor, instale o Node.js primeiro:
    echo https://nodejs.org (versao LTS)
    pause
    exit /b 1
)

echo Node.js detectado: 
node --version
echo.

cd /d "%~dp0"

echo Verificando frontend...
if not exist "frontend\dist\index.html" (
    echo Build necessario, executando...
    cd frontend
    call npm install >nul 2>&1
    call npm run build
    cd ..
)
echo.

echo Iniciando Backend na porta 3001...
start "SoftHair Backend" cmd /k "cd /d "%~dp0backend" && node src\server.js"

timeout /t 3 /nobreak >nul

echo Iniciando Frontend na porta 3000...
start "SoftHair Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================
echo SoftHair Iniciando...
echo ========================================
echo.
echo AGUARDE... abrindo navegador automaticamente
echo.

timeout /t 5 /nobreak >nul

start http://localhost:3000

echo.
echo SISTEMA PRONTO!
echo.
echo Acesse: http://localhost:3000
echo.
echo Manualmente mantenha ambas as janelas abertas
echo (Backend e Frontend)
echo.
pause