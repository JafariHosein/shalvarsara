# Stages the Go backend for deployment on Chabokan (chabok CLI).
#
# The Chabokan CLI deletes every file in the service directory on each deploy
# and uploads what you give it, so this script builds a clean copy that holds
# exactly what the Docker build needs -- and never the local `.env`, which has
# development secrets in it.
#
# Usage (from the repository root):
#   powershell -ExecutionPolicy Bypass -File scripts/deploy-chabokan-api.ps1
#   cd build\chabokan-api
#   chabok deploy

[CmdletBinding()]
param(
  [string]$OutDir = "build/chabokan-api"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root "backend"
$dst  = Join-Path $root $OutDir

# Names that must never reach a hosting panel.
$skip = @(".env", ".git", ".gitignore", "uploads", "bin", "tmp", "node_modules", "coverage")

if (-not (Test-Path (Join-Path $src "Dockerfile"))) {
  throw "backend/Dockerfile not found -- run this from the repository"
}

if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
New-Item -ItemType Directory -Force -Path $dst | Out-Null

Get-ChildItem -Force -Path $src |
  Where-Object { $skip -notcontains $_.Name } |
  Copy-Item -Destination $dst -Recurse -Force

if (Test-Path (Join-Path $dst ".env")) { throw "refusing to stage .env" }
if (-not (Test-Path (Join-Path $dst "go.mod"))) { throw "go.mod was not staged" }
if (-not (Test-Path (Join-Path $dst "migrations"))) { throw "migrations/ was not staged" }

$files = Get-ChildItem -Recurse -File $dst
$size  = ($files | Measure-Object -Sum Length).Sum

Write-Host ("staged -> {0}  ({1} files, {2:N1} KB)" -f $OutDir, $files.Count, ($size / 1KB))
Get-ChildItem -Force $dst | ForEach-Object { Write-Host ("   " + $_.Name) }

Write-Host ""
Write-Host "next:"
Write-Host ("   cd " + $OutDir)
Write-Host "   chabok deploy"
