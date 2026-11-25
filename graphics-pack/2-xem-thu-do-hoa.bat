@echo off
title Phong Thu Do Hoa - Ma Cho Art Studio
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0.."
echo ========================================================
echo   MA CHO - PHONG THU DO HOA (?preview=art)
echo ========================================================
echo Dang khoi dong may chu xem truoc...
echo Moi thay doi trong graphics-pack\assets\ se tu dong cap nhat ngay!
echo.
start "" "http://localhost:5173/?preview=art"
call npm run dev
pause
