@echo off
setlocal
title KeyNest Launcher

echo ======================================================================
echo                     KeyNest Credential Vault
echo ======================================================================
echo.

cd /d "%~dp0"

:: 1. Verify Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not found on your system!
    echo Please install Node.js v20 or higher from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check and install backend dependencies if missing
if not exist "%~dp0backend\node_modules\" (
    echo [SETUP] Installing backend dependencies...
    cd /d "%~dp0backend"
    call npm install
    cd /d "%~dp0"
    echo.
)

:: 3. Check and install frontend dependencies if missing
if not exist "%~dp0phase 2\node_modules\" (
    echo [SETUP] Installing frontend dependencies...
    cd /d "%~dp0phase 2"
    call npm install --legacy-peer-deps
    cd /d "%~dp0"
    echo.
)

:: 4. Start the Backend API (Port 4000) in its own window
echo [1/3] Starting Backend API on http://localhost:4000/api/v1 ...
start "KeyNest Backend (Port 4000)" /D "%~dp0backend" cmd /k "npm run dev"

:: Wait ~2 seconds for backend to initialize
ping 127.0.0.1 -n 3 >nul 2>&1

:: 5. Start the Frontend Web UI (Port 3000) in its own window
echo [2/3] Starting Frontend Web App on http://localhost:3000 ...
start "KeyNest Frontend (Port 3000)" /D "%~dp0phase 2" cmd /k "npm run dev"

:: Wait ~3 seconds for Vite to initialize
ping 127.0.0.1 -n 4 >nul 2>&1

:: 6. Launch default browser
echo [3/3] Opening KeyNest in your browser...
start http://localhost:3000

echo.
echo ======================================================================
echo   KeyNest is now running!
echo   - Web App:  http://localhost:3000
echo   - REST API: http://localhost:4000/api/v1 (Health: /health)
echo.
echo   Both servers are active in separate terminal windows.
echo   To stop the application, simply close those terminal windows.
echo ======================================================================
echo.
pause
