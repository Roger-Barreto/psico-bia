@echo off
setlocal
title PsicoBia - Encerrar

set "PORT=5173"

echo Encerrando PsicoBia...

REM ---- Kill server window by title ----
taskkill /F /FI "WINDOWTITLE eq PsicoBia Server*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Administrator: PsicoBia Server*" /T >nul 2>&1

REM ---- Kill any process listening on the port ----
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
    echo Encerrando processo PID %%P na porta %PORT%
    taskkill /F /PID %%P >nul 2>&1
)

REM ---- Kill orphan node processes from project dir ----
for /f "tokens=2 delims=," %%P in ('wmic process where "name='node.exe'" get ProcessId^,CommandLine /format:csv 2^>nul ^| findstr /i "PsicoBia"') do (
    taskkill /F /PID %%P >nul 2>&1
)

echo.
echo PsicoBia encerrado.
timeout /t 2 /nobreak >nul
endlocal
