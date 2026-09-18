@echo off
title WhiteboardX Server (Port 4876)
echo ========================================================
echo Starting WhiteboardX Canvas & WebSocket Server...
echo URL: http://localhost:4876
echo ========================================================
cd /d "%~dp0"
npm start
pause
