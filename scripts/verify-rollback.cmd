@echo off
REM Verifies the rollback path end to end against a THROWAWAY database, so the
REM developer's local data is never touched.
cd /d "%~dp0..\backend"
set PATH=C:\Program Files\Go\bin;%PATH%
set PSQL="C:\Program Files\PostgreSQL\16\bin\psql.exe"
set PGPASSWORD=shalvarsara
set OUT="%TEMP%\rollback.txt"
set SCRATCH=shalvarsara_rollback_check

echo === DROP/CREATE SCRATCH DB === > %OUT%
%PSQL% -h localhost -U shalvarsara -d postgres -tAc "DROP DATABASE IF EXISTS %SCRATCH%" >> %OUT% 2>&1
%PSQL% -h localhost -U shalvarsara -d postgres -tAc "CREATE DATABASE %SCRATCH%" >> %OUT% 2>&1

set DATABASE_URL=postgres://shalvarsara:shalvarsara@localhost:5432/%SCRATCH%?sslmode=disable
set APP_ENV=development
set RUN_MIGRATIONS=true

echo === UP === >> %OUT%
go run ./cmd/migrate up >> %OUT% 2>&1
echo UP_EXIT=%ERRORLEVEL% >> %OUT%
%PSQL% -h localhost -U shalvarsara -d %SCRATCH% -tAc "SELECT count(*) FROM schema_migrations" >> %OUT% 2>&1
%PSQL% -h localhost -U shalvarsara -d %SCRATCH% -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" >> %OUT% 2>&1

echo === DOWN ONE === >> %OUT%
go run ./cmd/migrate down >> %OUT% 2>&1
echo DOWN1_EXIT=%ERRORLEVEL% >> %OUT%
%PSQL% -h localhost -U shalvarsara -d %SCRATCH% -tAc "SELECT count(*) FROM schema_migrations" >> %OUT% 2>&1
%PSQL% -h localhost -U shalvarsara -d %SCRATCH% -tAc "SELECT coalesce((SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='coupon_code'),'GONE')" >> %OUT% 2>&1

echo === UP AGAIN (re-applies the one we removed) === >> %OUT%
go run ./cmd/migrate up >> %OUT% 2>&1
%PSQL% -h localhost -U shalvarsara -d %SCRATCH% -tAc "SELECT count(*) FROM schema_migrations" >> %OUT% 2>&1
%PSQL% -h localhost -U shalvarsara -d %SCRATCH% -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='coupon_code'" >> %OUT% 2>&1

echo === DOWN ALL === >> %OUT%
go run ./cmd/migrate down all >> %OUT% 2>&1
echo DOWNALL_EXIT=%ERRORLEVEL% >> %OUT%
%PSQL% -h localhost -U shalvarsara -d %SCRATCH% -tAc "SELECT count(*) FROM schema_migrations" >> %OUT% 2>&1
%PSQL% -h localhost -U shalvarsara -d %SCRATCH% -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" >> %OUT% 2>&1

echo === CLEANUP === >> %OUT%
%PSQL% -h localhost -U shalvarsara -d postgres -tAc "DROP DATABASE IF EXISTS %SCRATCH%" >> %OUT% 2>&1

echo DONE >> %OUT%
type %OUT%
