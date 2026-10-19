# Re-verifies the checks that need PATCH (the first script used POST by mistake).
#
# Credentials come from the environment so no password is committed:
#   $env:ADMIN_EMAIL    (default admin@example.com)
#   $env:ADMIN_PASSWORD (required)
$ErrorActionPreference = "Continue"
$out = "$env:TEMP\verify2.txt"
$API = "http://127.0.0.1:8080/api/v1"

$adminEmail = if ($env:ADMIN_EMAIL) { $env:ADMIN_EMAIL } else { "admin@example.com" }
if (-not $env:ADMIN_PASSWORD) {
    Write-Error "ADMIN_PASSWORD is not set. Export it first: `$env:ADMIN_PASSWORD = '<the admin password>'"
    exit 2
}

"=== VERIFY (PATCH routes) ===" | Out-File -Encoding utf8 $out
function Log($m) { $m | Out-File -Append -Encoding utf8 $out }

function Send($method, $path, $obj, $token) {
    $headers = @{}
    if ($token) { $headers["Authorization"] = "Bearer $token" }
    try {
        if ($null -eq $obj) {
            return @{ ok = $true; data = (Invoke-RestMethod -Uri "$API$path" -Method $method -Headers $headers -TimeoutSec 15) }
        }
        $tmp = [IO.Path]::GetTempFileName()
        [IO.File]::WriteAllText($tmp, ($obj | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding $false))
        try {
            return @{ ok = $true; data = (Invoke-RestMethod -Uri "$API$path" -Method $method -ContentType "application/json" -InFile $tmp -Headers $headers -TimeoutSec 15) }
        } finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
    } catch {
        $body = ""; try { $body = $_.ErrorDetails.Message } catch {}
        return @{ ok = $false; status = [int]$_.Exception.Response.StatusCode; body = $body }
    }
}

$tok = (Send "POST" "/auth/login" @{ email = $adminEmail; password = $env:ADMIN_PASSWORD } $null).data.tokens.accessToken
if (-not $tok) { Log "LOGIN FAILED"; "=== DONE ===" | Out-File -Append -Encoding utf8 $out; exit 1 }

# ---- relative image URL (the seeded shape) ----
$p7 = Send "GET" "/admin/products/7" $null $tok
$img = $p7.data.images[0]
Log "[A] image id=$($img.id) url=$($img.url)"
$rel = Send "PATCH" "/admin/images/$($img.id)" @{ url = $img.url; alt = "تست ویرایش"; isPrimary = $true; sortOrder = 1 } $tok
Log "[B] PATCH image with RELATIVE url -> $(if ($rel.ok) {'OK (fix confirmed)'} else {"FAILED $($rel.status) $($rel.body)"})"

# ---- validation boundaries ----
$abs = Send "PATCH" "/admin/images/$($img.id)" @{ url = "https://cdn.example.com/a.webp"; alt = "abs"; isPrimary = $true; sortOrder = 1 } $tok
Log "[C] absolute https -> $(if ($abs.ok) {'accepted (correct)'} else {"rejected $($abs.status) (WRONG)"})"
$proto = Send "PATCH" "/admin/images/$($img.id)" @{ url = "//evil.example/x.webp"; alt = "bad"; isPrimary = $true; sortOrder = 1 } $tok
Log "[D] protocol-relative //evil.example -> $(if ($proto.ok) {'ACCEPTED (SECURITY BUG)'} else {"rejected $($proto.status) (correct)"})"
$junk = Send "PATCH" "/admin/images/$($img.id)" @{ url = "not a url"; alt = "bad"; isPrimary = $true; sortOrder = 1 } $tok
Log "[E] 'not a url' -> $(if ($junk.ok) {'ACCEPTED (WRONG)'} else {"rejected $($junk.status) (correct)"})"
# restore
$null = Send "PATCH" "/admin/images/$($img.id)" @{ url = $img.url; alt = $img.alt; isPrimary = $img.isPrimary; sortOrder = $img.sortOrder } $tok

# ---- order status transitions ----
$pend = Send "GET" "/admin/orders?status=pending&limit=1" $null $tok
if ($pend.ok -and $pend.data.items.Count -gt 0) {
    $o = $pend.data.items[0].order
    Log "[F] pending order $($o.code) (id=$($o.id))"
    $toPaid = Send "PATCH" "/admin/orders/$($o.id)/status" @{ status = "paid" } $tok
    Log "[G] pending->paid -> $(if ($toPaid.ok) {'ACCEPTED (WRONG: fakes revenue)'} else {"refused $($toPaid.status): $($toPaid.body)"})"
    $toShip = Send "PATCH" "/admin/orders/$($o.id)/status" @{ status = "shipped" } $tok
    Log "[H] pending->shipped -> $(if ($toShip.ok) {'ACCEPTED (WRONG)'} else {"refused $($toShip.status) (correct)"})"
    $toCancel = Send "PATCH" "/admin/orders/$($o.id)/status" @{ status = "canceled" } $tok
    Log "[I] pending->canceled -> $(if ($toCancel.ok) {'accepted (correct)'} else {"refused $($toCancel.status): $($toCancel.body)"})"
    if ($toCancel.ok) {
        $again = Send "PATCH" "/admin/orders/$($o.id)/status" @{ status = "canceled" } $tok
        Log "[J] canceled->canceled again -> $(if ($again.ok) {'ACCEPTED (WRONG: would double-restock)'} else {"refused (correct, idempotent)"})"
    }
} else { Log "[F] no pending order to test" }

# ---- coupon fully-redeemed edit ----
$cps = Send "GET" "/admin/coupons?limit=50" $null $tok
$exhausted = $cps.data.items | Where-Object { $_.maxUses -gt 0 -and $_.usedCount -ge $_.maxUses } | Select-Object -First 1
if ($exhausted) {
    Log "[K] exhausted coupon $($exhausted.code) used=$($exhausted.usedCount)/$($exhausted.maxUses)"
    $deact = Send "PATCH" "/admin/coupons/$($exhausted.id)" @{ isActive = $false } $tok
    Log "[L] deactivate exhausted coupon -> $(if ($deact.ok) {'OK (fix confirmed)'} else {"refused $($deact.status): $($deact.body)"})"
} else { Log "[K] no exhausted coupon in the seed data to test" }

# ---- variant stock keeps the product aggregate in step ----
$prod = Send "GET" "/admin/products/7" $null $tok
if ($prod.data.variants.Count -gt 0) {
    $v = $prod.data.variants[0]
    $sum = ($prod.data.variants | Measure-Object -Property stock -Sum).Sum
    Log "[M] product 7 stock=$($prod.data.stock) ; sum(variant stock)=$sum"
    $bump = Send "PATCH" "/admin/variants/$($v.id)" @{ size = $v.size; color = $v.color; colorHex = $v.colorHex; stock = ($v.stock + 3); sku = $v.sku; extraPrice = $v.extraPrice } $tok
    if ($bump.ok) {
        $after = ($bump.data.variants | Measure-Object -Property stock -Sum).Sum
        Log "[N] after +3 on one variant: product stock=$($bump.data.stock) sum(variants)=$after -> $(if ($bump.data.stock -eq $after) {'IN STEP (fix confirmed)'} else {'OUT OF STEP (bug)'})"
        $null = Send "PATCH" "/admin/variants/$($v.id)" @{ size = $v.size; color = $v.color; colorHex = $v.colorHex; stock = $v.stock; sku = $v.sku; extraPrice = $v.extraPrice } $tok
    } else { Log "[N] variant PATCH failed $($bump.status): $($bump.body)" }
} else { Log "[M] product 7 has no variants" }

"=== DONE ===" | Out-File -Append -Encoding utf8 $out
