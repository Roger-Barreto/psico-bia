@echo off
setlocal
title PsicoBia - Encerrar

set "PORT=5173"

echo Encerrando PsicoBia (gracioso)...

REM ============================================================
REM  IMPORTANTE: encerramento gracioso (sem /F) primeiro, para
REM  o servidor terminar de gravar os dados em disco (fsync).
REM  Matar com /F durante uma escrita pode truncar os .json e
REM  causar perda de dados. So forcamos depois de um tempo de flush.
REM ============================================================

REM ---- Passo 1: pedir fechamento por titulo de janela (sem /F) ----
taskkill /FI "WINDOWTITLE eq PsicoBia Server*" /T >nul 2>&1
taskkill /FI "WINDOWTITLE eq Administrator: PsicoBia Server*" /T >nul 2>&1

REM ---- Passo 2: pedir fechamento dos processos na porta (sem /F) ----
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
    taskkill /PID %%P >nul 2>&1
)

REM ---- Passo 3: aguardar flush em disco ----
echo Aguardando gravacao em disco...
timeout /t 5 /nobreak >nul

REM ---- Passo 4: forcar o que ainda restar ----
taskkill /F /FI "WINDOWTITLE eq PsicoBia Server*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Administrator: PsicoBia Server*" /T >nul 2>&1
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
    echo Forcando processo PID %%P na porta %PORT%
    taskkill /F /PID %%P >nul 2>&1
)

REM ---- Passo 5: matar node orfaos do projeto (ultimo recurso) ----
for /f "tokens=2 delims=," %%P in ('wmic process where "name='node.exe'" get ProcessId^,CommandLine /format:csv 2^>nul ^| findstr /i "PsicoBia"') do (
    taskkill /F /PID %%P >nul 2>&1
)

echo.
echo PsicoBia encerrado.
timeout /t 2 /nobreak >nul
endlocal
