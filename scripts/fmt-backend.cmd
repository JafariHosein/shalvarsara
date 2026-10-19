@echo off
REM Formats every Go file in the backend. Output: %TEMP%\fmt.txt
setlocal
set "PATH=C:\Program Files\Go\bin;%PATH%"
cd /d "%~dp0..\backend"
set "OUT=%TEMP%\fmt.txt"

echo === GOFMT -w === > "%OUT%"
gofmt -w . >> "%OUT%" 2>&1
echo FMT_EXIT=%ERRORLEVEL% >> "%OUT%"
echo --- remaining unformatted (empty = clean) --- >> "%OUT%"
gofmt -l . >> "%OUT%" 2>&1
echo --- rebuild after formatting --- >> "%OUT%"
go build ./... >> "%OUT%" 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> "%OUT%"
type "%OUT%"
