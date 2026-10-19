@echo off
REM NOTE: "%%" is how a batch file writes a literal "%" — the earlier version of
REM this check wrote "%" and cmd.exe swallowed it, which made every URL look
REM like it started with something other than "/".
set PGPASSWORD=shalvarsara
set PSQL="C:\Program Files\PostgreSQL\16\bin\psql.exe"
set OUT="%TEMP%\imgcheck2.txt"

echo === image url shape === > %OUT%
%PSQL% -h localhost -U shalvarsara -d shalvarsara -tAc "SELECT CASE WHEN url LIKE '/%%' THEN 'relative' WHEN url ~* '^https?://' THEN 'absolute' ELSE 'other:' || left(url,30) END AS kind, count(*) FROM product_images GROUP BY 1 ORDER BY 1" >> %OUT% 2>&1

echo === sample === >> %OUT%
%PSQL% -h localhost -U shalvarsara -d shalvarsara -tAc "SELECT left(url, 45) FROM product_images ORDER BY id LIMIT 5" >> %OUT% 2>&1

echo DONE >> %OUT%
type %OUT%
