@echo off
setlocal enabledelayedexpansion
title PsicoBia - Atualizar

set "PROJECT_DIR=%USERPROFILE%\PsicoBia"
set "GIT_DEFAULT=C:\Program Files\Git\cmd"
set "NODE_DEFAULT=C:\Program Files\nodejs"
set "PORT=5173"
set "URL=http://localhost:%PORT%"

echo ============================================
echo            PsicoBia - Atualizar
echo ============================================
echo.

if not exist "%PROJECT_DIR%\.git" (
    echo [ERRO] PsicoBia nao encontrado em %PROJECT_DIR%
    echo Execute Install-PsicoBia.bat primeiro.
    pause
    exit /b 1
)

REM ---- Ensure Git on PATH ----
where git >nul 2>&1
if errorlevel 1 (
    if exist "%GIT_DEFAULT%\git.exe" set "PATH=%GIT_DEFAULT%;!PATH!"
)
where git >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Git nao encontrado.
    echo Execute Install-PsicoBia.bat ou reinicie o computador.
    pause
    exit /b 1
)

REM ---- Ensure Node on PATH ----
where node >nul 2>&1
if errorlevel 1 (
    if exist "%NODE_DEFAULT%\node.exe" set "PATH=%NODE_DEFAULT%;!PATH!"
)
where node >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado.
    echo Execute Install-PsicoBia.bat ou reinicie o computador.
    pause
    exit /b 1
)

REM ---- Stop running server if any ----
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo [1/3] Encerrando servidor em execucao (gracioso)...
    REM Gracioso primeiro (sem /F) para o servidor gravar os dados em disco.
    taskkill /FI "WINDOWTITLE eq PsicoBia Server*" /T >nul 2>&1
    taskkill /FI "WINDOWTITLE eq Administrator: PsicoBia Server*" /T >nul 2>&1
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
        taskkill /PID %%P >nul 2>&1
    )
    echo Aguardando gravacao em disco...
    timeout /t 5 /nobreak >nul
    REM Forcar o que restar.
    taskkill /F /FI "WINDOWTITLE eq PsicoBia Server*" /T >nul 2>&1
    taskkill /F /FI "WINDOWTITLE eq Administrator: PsicoBia Server*" /T >nul 2>&1
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
        taskkill /F /PID %%P >nul 2>&1
    )
) else (
    echo [1/3] Servidor nao estava em execucao.
)

pushd "%PROJECT_DIR%"

REM ---- Capture HEAD before pull to detect changes ----
for /f "delims=" %%H in ('git rev-parse HEAD') do set "OLD_HEAD=%%H"

echo [2/3] Baixando atualizacoes (git pull --rebase --autostash)...
git pull --rebase --autostash
if errorlevel 1 (
    echo [ERRO] Falha no git pull. Resolva conflitos manualmente em %PROJECT_DIR%.
    popd
    pause
    exit /b 1
)

for /f "delims=" %%H in ('git rev-parse HEAD') do set "NEW_HEAD=%%H"

if "%OLD_HEAD%"=="%NEW_HEAD%" (
    echo Nenhuma atualizacao disponivel. Ja esta na versao mais recente.
    echo [3/3] Verificando dependencias...
) else (
    echo Atualizado de %OLD_HEAD:~0,7% para %NEW_HEAD:~0,7%.
    echo [3/3] Atualizando dependencias (npm install)...
)

call npm install
if errorlevel 1 (
    echo [ERRO] Falha em npm install.
    popd
    pause
    exit /b 1
)

popd

echo.
echo ============================================
echo  PsicoBia atualizado com sucesso.
echo  Para iniciar: execute Start-PsicoBia.bat
echo ============================================
echo.
pause
endlocal
