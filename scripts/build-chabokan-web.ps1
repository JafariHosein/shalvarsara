# Builds the storefront and stages it for the Chabokan "Static" service.
#
# Vite bakes VITE_API_BASE_URL into the bundle at build time, so the API address
# has to be known before the build. Chabokan's static service serves the
# `dist/` directory of the deployed project (its default nginx root is
# /app/dist), so the staged folder is `build\chabokan-web` containing `dist\`.
#
# Usage (from the repository root):
#   powershell -ExecutionPolicy Bypass -File scripts/build-chabokan-web.ps1 `
#     -ApiBaseUrl https://api-xxxx.irnx.chabokan.net/api/v1
#   cd build\chabokan-web
#   chabok deploy

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ApiBaseUrl,
  [string]$AppName = "",
  [string]$OutDir = "build/chabokan-web"
)

$ErrorActionPreference = "Stop"

$root     = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root "frontend"
$dist     = Join-Path $frontend "dist"
$dst      = Join-Path $root $OutDir

$api = $ApiBaseUrl.TrimEnd("/")
if ($api -notmatch "^https?://") {
  throw "-ApiBaseUrl must be a full absolute address, e.g. https://api.example.com/api/v1"
}

Push-Location $frontend
try {
  # The value is exported for the child process: real environment variables win
  # over frontend/.env inside Vite.
  $env:VITE_API_BASE_URL = $api
  if ($AppName -ne "") { $env:VITE_APP_NAME = $AppName }

  # npm is blocked in PowerShell on this machine, so go through cmd.exe.
  cmd /c "npm run build"
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
  Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue
  if ($AppName -ne "") { Remove-Item Env:VITE_APP_NAME -ErrorAction SilentlyContinue }
}

if (-not (Test-Path (Join-Path $dist "index.html"))) {
  throw "frontend/dist/index.html not found -- did the build succeed?"
}

if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item -Path $dist -Destination $dst -Recurse -Force

$files = Get-ChildItem -Recurse -File $dst
$size  = ($files | Measure-Object -Sum Length).Sum

Write-Host ("api base baked in : {0}" -f $api)
Write-Host ("staged            : {0}  ({1} files, {2:N1} MB)" -f $OutDir, $files.Count, ($size / 1MB))

Write-Host ""
Write-Host "next:"
Write-Host ("   cd " + $OutDir)
Write-Host "   chabok deploy"
