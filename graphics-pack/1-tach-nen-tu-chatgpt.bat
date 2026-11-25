@echo off
title Tach Nen Tu Dong Tu ChatGPT - Ma Cho
set PATH=C:\Program Files\nodejs;%PATH%
echo ========================================================
echo   MA CHO - CONG CU TACH NEN TU ANH CHATGPT (512x512)
echo ========================================================
echo.
node "%~dp0tools\auto-cutout.mjs"
echo.
pause
