@echo off
echo [Mobile Build Helper] Starting setup...

echo 1. Installing dependencies (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed. Please check if Node.js is installed correctly.
    pause
    exit /b %errorlevel%
)

echo 2. Adding Android platform...
if not exist "android" (
    call npx cap add android
) else (
    echo Android platform already added. Skipping...
)

echo 3. Syncing changes...
call npx cap sync

echo 4. Opening Android Studio...
echo (Please wait for Android Studio to launch...)
call npx cap open android

echo [Success] Android Studio should now be opening. build or run your app from there!
pause
