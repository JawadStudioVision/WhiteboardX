@echo off
title Cloudflare Quick Tunnel for WhiteboardX
echo ========================================================
echo Starting Cloudflare Quick Tunnel on Port 4876...
echo A temporary public https://*.trycloudflare.com URL will be generated.
echo ========================================================
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:4876
pause
