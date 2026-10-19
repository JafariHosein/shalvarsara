@echo off
REM Shared preamble for the database scripts: finds psql and builds the common
REM connection arguments. `call` this from another script, then use %PSQL%.
REM
REM Connection settings come from the environment when set, so the same script
REM works against a different host/user without editing:
REM   set PGHOST=... & set PGUSER=... & set PGPASSWORD=... & set PGDATABASE=...
setlocal
set "PGBIN="
for %%v in (17 16 15 14) do (
  if not defined PGBIN if exist "C:\Program Files\PostgreSQL\%%v\bin\psql.exe" set "PGBIN=C:\Program Files\PostgreSQL\%%v\bin"
)
if not defined PGBIN (
  for %%p in (psql.exe) do if not "%%~$PATH:p"=="" set "PGBIN=%%~dp$PATH:p"
)
if not defined PGBIN (
  echo psql.exe not found. Install PostgreSQL or add its bin directory to PATH. 1>&2
  exit /b 1
)

if "%PGHOST%"=="" set "PGHOST=localhost"
if "%PGUSER%"=="" set "PGUSER=shalvarsara"
if "%PGPASSWORD%"=="" set "PGPASSWORD=shalvarsara"
if "%PGDATABASE%"=="" set "PGDATABASE=shalvarsara"

endlocal & set "PSQL=%PGBIN%\psql.exe" & set "PGHOST=%PGHOST%" & set "PGUSER=%PGUSER%" & set "PGPASSWORD=%PGPASSWORD%" & set "PGDATABASE=%PGDATABASE%"
exit /b 0
