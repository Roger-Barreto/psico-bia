@echo off
setlocal enabledelayedexpansion
title PsicoBia - Instalador

set "REPO_URL=https://github.com/Roger-Barreto/psico-bia.git"
set "PROJECT_DIR=%USERPROFILE%\PsicoBia"
set "GIT_DEFAULT=C:\Program Files\Git\cmd"
set "NODE_DEFAULT=C:\Program Files\nodejs"
set "PORT=5173"
set "URL=http://localhost:%PORT%"

echo ============================================
echo            PsicoBia - Instalador
echo ============================================
echo.

REM ---- Verify winget exists ----
where winget >nul 2>&1
if errorlevel 1 (
    echo [ERRO] winget nao encontrado.
    echo Atualize o Windows ou instale o "App Installer" da Microsoft Store.
    pause
    exit /b 1
)

REM ---- Install Git ----
where git >nul 2>&1
if errorlevel 1 (
    echo [1/5] Instalando Git...
    winget install --id Git.Git -e --silent --accept-package-agreements --accept-source-agreements
    if exist "%GIT_DEFAULT%\git.exe" set "PATH=%GIT_DEFAULT%;!PATH!"
) else (
    echo [1/5] Git ja instalado.
)

where git >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Falha ao instalar Git. Reinicie o computador e tente novamente.
    pause
    exit /b 1
)

REM ---- Install Node.js LTS ----
where node >nul 2>&1
if errorlevel 1 (
    echo [2/5] Instalando Node.js LTS...
    winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements
    if exist "%NODE_DEFAULT%\node.exe" set "PATH=%NODE_DEFAULT%;!PATH!"
) else (
    echo [2/5] Node.js ja instalado.
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Falha ao instalar Node.js. Reinicie o computador e tente novamente.
    pause
    exit /b 1
)

REM ---- Clone or update repo ----
if not exist "%PROJECT_DIR%\.git" (
    echo [3/5] Clonando repositorio em %PROJECT_DIR% ...
    git clone "%REPO_URL%" "%PROJECT_DIR%"
    if errorlevel 1 (
        echo [ERRO] Falha ao clonar repositorio.
        pause
        exit /b 1
    )
) else (
    echo [3/5] Atualizando repositorio...
    pushd "%PROJECT_DIR%"
    git pull --rebase --autostash
    popd
)

pushd "%PROJECT_DIR%"

REM ---- Install dependencies ----
echo [4/5] Instalando dependencias (npm install)...
call npm install
if errorlevel 1 (
    echo [ERRO] Falha em npm install.
    popd
    pause
    exit /b 1
)

REM ---- Start dev server in separate window ----
echo [5/5] Iniciando servidor...
start "PsicoBia Server" cmd /k "cd /d %PROJECT_DIR% && npm run dev"

REM ---- Wait for server to be ready ----
echo Aguardando servidor...
set /a TRIES=0
:waitloop
set /a TRIES+=1
if !TRIES! gtr 60 (
    echo [ERRO] Servidor nao respondeu em 60 segundos.
    popd
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -Uri '%URL%' -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto waitloop

echo.
echo Servidor pronto. Abrindo navegador...
start "" "%URL%"

popd

echo.
echo ============================================
echo  PsicoBia esta rodando em %URL%
echo  Para encerrar: execute Stop-PsicoBia.bat
echo ============================================
echo.
pause
endlocal
