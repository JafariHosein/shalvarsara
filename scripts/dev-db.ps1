# Creates the local development database on a native PostgreSQL 16 install.
#
# Use this when you are running PostgreSQL directly on Windows instead of via
# `docker compose up -d db`. It creates:
#   * role     shalvarsara / shalvarsara   (superuser, local development only)
#   * database shalvarsara
#   * the pg_trgm extension the schema depends on
#
# The role is a superuser because the migration creates extensions; never do
# this on a shared or production server.
#
# Usage (from the repository root):
#   powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1 -PgBin "C:\Program Files\PostgreSQL\16\bin"

param(
    [string]$PgBin = "C:\Program Files\PostgreSQL\16\bin",
    [string]$Host_ = "127.0.0.1",
    [int]$Port = 5432,
    [string]$SuperUser = "postgres",
    [string]$SuperPassword = "postgres",
    [string]$AppUser = "shalvarsara",
    [string]$AppPassword = "shalvarsara",
    [string]$Database = "shalvarsara"
)

$ErrorActionPreference = "Stop"

$psql = Join-Path $PgBin "psql.exe"
if (-not (Test-Path $psql)) {
    Write-Error "psql not found at $psql. Pass -PgBin with the correct path."
}

function Invoke-Sql {
    param([string]$Db, [string]$Sql, [string]$User, [string]$Password)
    $env:PGPASSWORD = $Password
    $out = & $psql -h $Host_ -p $Port -U $User -d $Db -tAc $Sql 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw "SQL failed: $($out.Trim())" }
    return $out.Trim()
}

Write-Output "Checking connectivity to ${Host_}:${Port} ..."
$null = Invoke-Sql -Db "postgres" -Sql "SELECT 1" -User $SuperUser -Password $SuperPassword

if ((Invoke-Sql -Db "postgres" -Sql "SELECT 1 FROM pg_roles WHERE rolname='$AppUser'" -User $SuperUser -Password $SuperPassword) -ne "1") {
    $env:PGPASSWORD = $SuperPassword
    & $psql -h $Host_ -p $Port -U $SuperUser -d postgres -c "CREATE ROLE $AppUser LOGIN SUPERUSER PASSWORD '$AppPassword'" | Out-Null
    Write-Output "created role $AppUser"
} else {
    Write-Output "role $AppUser already exists"
}

if ((Invoke-Sql -Db "postgres" -Sql "SELECT 1 FROM pg_database WHERE datname='$Database'" -User $SuperUser -Password $SuperPassword) -ne "1") {
    $env:PGPASSWORD = $SuperPassword
    & $psql -h $Host_ -p $Port -U $SuperUser -d postgres -c "CREATE DATABASE $Database OWNER $AppUser ENCODING 'UTF8' TEMPLATE template0" | Out-Null
    Write-Output "created database $Database"
} else {
    Write-Output "database $Database already exists"
}

$env:PGPASSWORD = $SuperPassword
& $psql -h $Host_ -p $Port -U $SuperUser -d $Database -c "CREATE EXTENSION IF NOT EXISTS pg_trgm" | Out-Null
Write-Output "ensured extension pg_trgm"

$identity = Invoke-Sql -Db $Database -Sql "SELECT current_user || ' @ ' || current_database()" -User $AppUser -Password $AppPassword
Write-Output "OK: $identity"
Write-Output ""
Write-Output "Next:"
Write-Output "  cd backend; go run ./cmd/migrate; go run ./cmd/seed; go run ./cmd/api"
