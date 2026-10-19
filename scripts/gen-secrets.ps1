# Generates strong random secrets for a local or production .env file.
#
#   pwsh -File scripts/gen-secrets.ps1
#
# Copy the two JWT lines into your .env (or into the hosting dashboard's
# environment variables). Never commit the generated values.

$ErrorActionPreference = "Stop"

function New-Secret([int]$Bytes = 48) {
    $buffer = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($buffer)
    # URL-safe base64: no '+', '/', or '=' to confuse shells, URLs, or dashboards.
    [Convert]::ToBase64String($buffer).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$access = New-Secret
$refresh = New-Secret

Write-Output ""
Write-Output "# --- paste into .env (and into your host's env vars) ---"
Write-Output "JWT_ACCESS_SECRET=$access"
Write-Output "JWT_REFRESH_SECRET=$refresh"
Write-Output ""
Write-Output "# The two values must differ and be at least 32 characters."
Write-Output "# The API refuses to start if either still holds an example value."
Write-Output ""
