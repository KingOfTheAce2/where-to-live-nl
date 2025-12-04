@echo off
echo ===============================================
echo Starting Where to Live NL Application
echo ===============================================
echo.
echo Starting Python Backend (port 8000)...
start "Backend API" cmd /k "cd backend && python api_server.py"
timeout /t 3 /nobreak >nul
echo.
echo Starting Next.js Frontend (port 3000)...
start "Frontend Dev Server" cmd /k "cd frontend && npm run dev"
echo.
echo ===============================================
echo Application is starting...
echo.
echo Backend API: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Close both terminal windows to stop the application.
echo ===============================================
