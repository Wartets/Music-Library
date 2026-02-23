@echo off
setlocal EnableDelayedExpansion
title Music Library - Launcher

:: Force UTF-8 in the console
chcp 65001 >nul

:: Use PowerShell to get a safe, unique timestamp for the log filename
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'"`) do set "TS=%%i"
set "LOG_FILE=logs\launch_%TS%.log"

if not exist logs mkdir logs

echo  =============================================================
echo   MUSIC LIBRARY - VITE ARCHITECT LAUNCHER
echo  =============================================================
echo   Log File: %LOG_FILE%
echo.

:: We use PowerShell to run the main logic and force UTF8 WITH BOM for the log file
:: (Windows notepad and other tools prefer BOM for UTF8)
set "NO_COLOR=1"
set "FORCE_COLOR=0"

echo [1/2] Initializing environment...
powershell -NoProfile -Command "$OutputEncoding = [System.Text.Encoding]::UTF8; cmd /c 'call :LOGIC' | Out-File -FilePath '%LOG_FILE%' -Encoding utf8"

if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Launch failed. Details in: %LOG_FILE%
) else (
    color 0A
    echo [SUCCESS] Environment ready and server starting.
)

echo.
echo [INFO] Press any key to close this launcher.
pause
exit /b

:LOGIC
echo --- Session Start: %date% %time% ---
echo Directory: %CD%

echo [STEP] Checking Node...
node -v
if errorlevel 1 (
    echo [CRITICAL] Node.js not found in PATH.
    exit /b 1
)

echo [STEP] Verifying Dependencies...
if not exist "package.json" (
    echo [CRITICAL] package.json missing.
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install --legacy-peer-deps
) else (
    if not exist "node_modules\vite" (
        echo [INFO] Vite folder missing. Repairing...
        call npm install --legacy-peer-deps
    ) else (
        echo [OK] Dependencies verified.
    )
)

echo [STEP] Starting Backend Services...
if exist "%temp%\lib_open.bat" del "%temp%\lib_open.bat"
echo @echo off > "%temp%\lib_open.bat"
echo timeout /t 8 /nobreak ^>nul >> "%temp%\lib_open.bat"
echo start http://localhost:5173 >> "%temp%\lib_open.bat"
echo del "%%~f0" >> "%temp%\lib_open.bat"
start /B "" "%temp%\lib_open.bat"

echo [STEP] Executing Vite...
:: Run vite in the background and pipe output to log
call npm run dev
goto :EOF