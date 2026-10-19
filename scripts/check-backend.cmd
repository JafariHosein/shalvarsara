@echo off
REM Backend gate: build + vet + gofmt + tests. Output: %TEMP%\check.txt
setlocal
set "PATH=C:\Program Files\Go\bin;%PATH%"
cd /d "%~dp0..\backend"
set "OUT=%TEMP%\check.txt"

echo === BUILD === > "%OUT%"
go build ./... >> "%OUT%" 2>&1
echo BUILD_EXIT=%ERRORLEVEL% >> "%OUT%"

echo === VET === >> "%OUT%"
go vet ./... >> "%OUT%" 2>&1
echo VET_EXIT=%ERRORLEVEL% >> "%OUT%"

echo === GOFMT (files listed below are NOT formatted) === >> "%OUT%"
gofmt -l . >> "%OUT%" 2>&1

echo === TESTS === >> "%OUT%"
go test ./... >> "%OUT%" 2>&1
echo TEST_EXIT=%ERRORLEVEL% >> "%OUT%"

echo DONE >> "%OUT%"
type "%OUT%"
