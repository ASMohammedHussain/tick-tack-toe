@echo off
cd /d "%~dp0"
echo Starting local web server in %cd%
echo Open http://localhost:8000 in your browser.
py -3 -m http.server 8000 2>nul || python -m http.server 8000 2>nul
if errorlevel 1 (
  echo.
  echo Python was not found.
  echo Install Python or use a different local server tool.
  echo For example, if Node.js is installed, run:
  echo    npx http-server -p 8000
  pause
)
