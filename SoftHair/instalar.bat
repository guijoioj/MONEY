@echo off
echo ========================================
echo    INSTALADOR SOFTHAIR
echo    Sistema de Gestao de Salao
echo ========================================
echo.

REM Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERRO: Node.js NAO ESTA INSTALADO
    echo Por favor, instale o Node.js primeiro
    echo Baixe em: https://nodejs.org
    pause
    exit /b 1
)

echo Node.js detectado
echo.

REM Instalar dependencias do root
echo Instalando dependencias...
cd /d "%~dp0"
call npm install >nul 2>&1

REM Build do frontend (se necessario)
echo.
echo Verificando build do frontend...
if not exist "frontend\dist\index.html" (
    echo Build do frontend necessario...
    cd frontend
    call npm install >nul 2>&1
    call npm run build
    cd ..
)

echo.
echo ========================================
echo INSTALACAO CONCLUIDA!
echo ========================================
echo.
echo Para usar o SoftHair:
echo   1. Execute: npm run start
echo   2. Ou crie um atalho para o arquivo
echo.
echo Para desenvolver:
echo   Execute: npm run dev
echo.
pause