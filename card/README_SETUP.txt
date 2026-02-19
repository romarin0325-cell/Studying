# Card RPG Setup Instructions

## 1. Game Execution
- Double-click `run_game.bat` to start the game.
- Or, simply open `index.html` in your web browser (Chrome, Edge, etc.).

## 2. API Key Setup
This game requires a Google Gemini API Key to generate content (battles, quizzes, etc.).

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey) and get an API key.
2. Start the game.
3. Click the "Menu" button -> "API Settings".
4. Enter your API Key and click "Save".

## 3. Troubleshooting
- If the game performs strangely or data doesn't load, check your internet connection.
- If you see "CORS" errors in the browser console (F12), it might be due to running from a local file.
  - In most cases, it should work fine.
  - If it fails, try using a simple HTTP server (e.g., if you install Python later: `python -m http.server`).

Enjoy!
