@echo off
title Ma Soi Pixel Village - Server
set PATH=C:\Program Files\nodejs;%PATH%
echo ===================================================
echo   MA SOI PIXEL VILLAGE - SERVER ^& PUBLIC LINK
echo ===================================================
echo [1/2] Dang cap nhat giao dien moi nhat...
call npm run build
echo [2/2] Khoi chay server game tai http://localhost:3001
echo.
echo De choi voi ban be qua Internet (HTTPS de bat Mic):
echo   - Cach 1: Chay lenh "cloudflared tunnel --url http://localhost:3001" o cua so khac
echo   - Cach 2: Deploy mien phi len Render.com bang file render.yaml co san
echo.
set PORT=3001
node server/index.js
pause
