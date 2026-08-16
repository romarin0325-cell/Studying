@echo off
setlocal

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js was not found. Using the existing music manifest.
) else (
    node "%~dp0..\scripts\generate_card_music_manifest.js"
    if errorlevel 1 (
        echo Failed to generate the card music manifest.
        pause
        exit /b 1
    )
)

start "" "%~dp0index.html"
