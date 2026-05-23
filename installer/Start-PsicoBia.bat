@echo off
setlocal enabledelayedexpansion
title PsicoBia - Iniciar

set "PROJECT_DIR=%USERPROFILE%\PsicoBia"
set "NODE_DEFAULT=C:\Program Files\nodejs"
set "PORT=5173"
set "URL=http://localhost:%PORT%"

echo ============================================
echo            PsicoBia - Iniciar
echo ============================================
echo.

if not exist "%PROJECT_DIR%\package.json" (
    echo [ERRO] PsicoBia nao encontrado em %PROJECT_DIR%
    echo Execute Install-PsicoBia.bat primeiro.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    if exist "%NODE_DEFAULT%\node.exe" (
        set "PATH=%NODE_DEFAULT%;%PATH%"
    )
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado.
    echo Execute Install-PsicoBia.bat ou reinicie o computador apos a instalacao.
    pause
    exit /b 1
)

REM ---- Already running? Just open the browser ----
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo PsicoBia ja esta rodando em %URL%
    start "" "%URL%"
    echo.
    pause
    exit /b 0
)

echo Iniciando servidor...
start "PsicoBia Server" cmd /k "cd /d %PROJECT_DIR% && npm run dev"

echo Aguardando servidor...
set /a TRIES=0
:waitloop
set /a TRIES+=1
if !TRIES! gtr 60 (
    echo [ERRO] Servidor nao respondeu em 60 segundos.
    echo Verifique a janela "PsicoBia Server" para detalhes.
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto waitloop

echo.
echo Servidor pronto. Abrindo navegador...
start "" "%URL%"

echo.
echo ============================================
echo  PsicoBia esta rodando em %URL%
echo  Para encerrar: execute Stop-PsicoBia.bat
echo ============================================
echo.
pause
endlocal
