@echo off
setlocal
title AirShare - Local High-Speed File Transfer
cd /d "%~dp0"

echo ===================================================
echo   AirShare - Local High-Speed File Transfer
echo ===================================================
echo.

:: Automatically kill any orphaned process holding port 3000
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :3000 ^| findstr LISTENING') do (
    echo Freeing port 3000 [PID: %%a]...
    taskkill /F /PID %%a >nul 2>&1
)

:: Verify Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in your PATH.
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Starting AirShare server...
node server.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] AirShare server exited unexpectedly [Exit code: %ERRORLEVEL%].
    pause
)
