@echo off
title Cloudflare Tunnel for WhiteboardX (w.studiovision.org)
echo ========================================================
echo Starting Cloudflare Tunnel for w.studiovision.org...
echo Pointing to local WhiteboardX at http://localhost:4876
echo ========================================================
cd /d "%~dp0"
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --config cloudflare/config.yml run whiteboardx
pause
