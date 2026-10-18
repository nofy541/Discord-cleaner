@echo off
title Discord Cleaner
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1

py "%~dp0main.py"
if %ERRORLEVEL% EQU 0 goto end

python "%~dp0main.py"
if %ERRORLEVEL% EQU 0 goto end

echo.
echo ====================================================
echo [ОШИБКА] Не удалось запустить программу!
echo ====================================================
echo.
pause

:end
