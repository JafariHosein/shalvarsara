@echo off
REM Full frontend gate: tests + production build (which runs tsc first).
REM Output: %TEMP%\fetest.txt
setlocal
cd /d "%~dp0..\frontend"
set "OUT=%TEMP%\fetest.txt"

echo === TEST === > "%OUT%"
call cmd /c "npm run test" >> "%OUT%" 2>&1
echo TEST_EXIT=%ERRORLEVEL% >> "%OUT%"

echo === BUILD === >> "%OUT%"
call cmd /c "npm run build" >> "%OUT%" 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> "%OUT%"

echo DONE >> "%OUT%"
type "%OUT%"
