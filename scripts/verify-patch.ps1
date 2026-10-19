# Exercises the admin partial-PATCH semantics against the running API.
# Every step asserts on real responses; nothing is assumed.
#
# Credentials come from the environment so no password is committed:
#   $env:ADMIN_EMAIL    (default admin@example.com)
#   $env:ADMIN_PASSWORD (required)
$ErrorActionPreference = "Continue"
$base = "http://127.0.0.1:8080/api/v1"
$out  = "$env:TEMP\patchtest.txt"

$adminEmail = if ($env:ADMIN_EMAIL) { $env:ADMIN_EMAIL } else { "admin@example.com" }
if (-not $env:ADMIN_PASSWORD) {
  Write-Error "ADMIN_PASSWORD is not set. Export it first: `$env:ADMIN_PASSWORD = '<the admin password>'"
  exit 2
}

function W($m) { Add-Content -Path $out -Value $m -Encoding UTF8 }
Set-Content -Path $out -Value "=== admin partial PATCH semantics ===" -Encoding UTF8

function Call($method, $path, $body, $token) {
  $headers = @{}
  if ($token) { $headers["Authorization"] = "Bearer $token" }
  $args = @{ Uri = "$base$path"; Method = $method; Headers = $headers; ContentType = "application/json" }
  if ($body) { $args["Body"] = ($body | ConvertTo-Json -Compress) }
  try {
    $r = Invoke-WebRequest @args -UseBasicParsing
    return @{ ok = $true; code = $r.StatusCode; body = ($r.Content | ConvertFrom-Json) }
  } catch {
    $resp = $_.Exception.Response
    $code = if ($resp) { [int]$resp.StatusCode } else { 0 }
    $text = ""
    try { $text = (New-Object IO.StreamReader($resp.GetResponseStream())).ReadToEnd() } catch {}
    return @{ ok = $false; code = $code; raw = $text }
  }
}

# ---- sign in as admin ----
$login = Call "POST" "/auth/login" @{ email = $adminEmail; password = $env:ADMIN_PASSWORD } $null
if (-not $login.ok) { W "LOGIN FAILED: $($login.code)"; exit 1 }
$token = $login.body.tokens.accessToken
W "login OK as $adminEmail"

# ---- find a product with an image and a variant ----
$list = Call "GET" "/admin/products?limit=50" $null $token
if (-not $list.ok) { W "LIST FAILED: $($list.code)"; exit 1 }
$product = $list.body.items | Where-Object { $_.images.Count -gt 0 -and $_.variants.Count -gt 0 } | Select-Object -First 1
if (-not $product) { W "no product with both an image and a variant found"; exit 1 }
W "product=$($product.id) images=$($product.images.Count) variants=$($product.variants.Count)"

# ---- 1) variant: patch ONLY stock; everything else must survive ----
$variant = $product.variants[0]
$before = "size=$($variant.size) color=$($variant.color) hex=$($variant.colorHex) stock=$($variant.stock) sku=$($variant.sku) extra=$($variant.extraPrice)"
W "variant BEFORE: $before"

$r = Call "PATCH" "/admin/variants/$($variant.id)" @{ stock = ($variant.stock + 7) } $token
if (-not $r.ok) { W "VARIANT PATCH FAILED: $($r.code) $($r.raw)" }
else {
  $v = $r.body.variants | Where-Object { $_.id -eq $variant.id }
  $after = "size=$($v.size) color=$($v.color) hex=$($v.colorHex) stock=$($v.stock) sku=$($v.sku) extra=$($v.extraPrice)"
  W "variant AFTER : $after"
  $keptSize  = ($v.size -eq $variant.size)
  $keptColor = ($v.color -eq $variant.color)
  $keptHex   = ($v.colorHex -eq $variant.colorHex)
  $keptSku   = ($v.sku -eq $variant.sku)
  $keptExtra = ($v.extraPrice -eq $variant.extraPrice)
  $stockOk   = ($v.stock -eq ($variant.stock + 7))
  W "  kept size=$keptSize color=$keptColor hex=$keptHex sku=$keptSku extraPrice=$keptExtra; stock updated=$stockOk"
  if ($keptSize -and $keptColor -and $keptHex -and $keptSku -and $keptExtra -and $stockOk) {
    W "  RESULT: OK - partial variant PATCH preserved every untouched field"
  } else {
    W "  RESULT: ** FAIL ** - a field was clobbered by the patch"
  }
}

# ---- 2) variant: explicit stock=0 must be honoured, not treated as absent ----
$r0 = Call "PATCH" "/admin/variants/$($variant.id)" @{ stock = 0 } $token
if ($r0.ok) {
  $v0 = $r0.body.variants | Where-Object { $_.id -eq $variant.id }
  W "explicit stock=0 -> stored stock=$($v0.stock) (want 0)"
} else { W "stock=0 PATCH FAILED: $($r0.code) $($r0.raw)" }

# restore
$null = Call "PATCH" "/admin/variants/$($variant.id)" @{ stock = $variant.stock } $token
W "variant stock restored to $($variant.stock)"

# ---- 3) image: promote to primary by sending ONLY isPrimary ----
$image = $product.images | Where-Object { -not $_.isPrimary } | Select-Object -First 1
if ($image) {
  W "image BEFORE: id=$($image.id) url=$($image.url) alt='$($image.alt)' primary=$($image.isPrimary) sort=$($image.sortOrder)"
  $r2 = Call "PATCH" "/admin/images/$($image.id)" @{ isPrimary = $true } $token
  if (-not $r2.ok) { W "IMAGE PATCH FAILED: $($r2.code) $($r2.raw)" }
  else {
    $i = $r2.body.images | Where-Object { $_.id -eq $image.id }
    W "image AFTER : url=$($i.url) alt='$($i.alt)' primary=$($i.isPrimary) sort=$($i.sortOrder)"
    $urlOk = ($i.url -eq $image.url)
    $altOk = ($i.alt -eq $image.alt)
    $sortOk = ($i.sortOrder -eq $image.sortOrder)
    W "  kept url=$urlOk alt=$altOk sortOrder=$sortOk; became primary=$($i.isPrimary)"
    $others = @($r2.body.images | Where-Object { $_.isPrimary })
    W "  primary image count now = $($others.Count) (want 1)"
    if ($urlOk -and $altOk -and $sortOk -and $i.isPrimary -and $others.Count -eq 1) {
      W "  RESULT: OK - one-field image PATCH promoted without clobbering; exactly one primary"
    } else { W "  RESULT: ** FAIL **" }
  }
} else { W "no non-primary image to promote (all already primary)" }

# ---- 4) image: re-saving an EXISTING relative URL must succeed (the old bug) ----
$rel = $product.images | Where-Object { $_.url -like "/products/*" } | Select-Object -First 1
if ($rel) {
  $r3 = Call "PATCH" "/admin/images/$($rel.id)" @{ url = $rel.url; alt = $rel.alt; isPrimary = $rel.isPrimary; sortOrder = $rel.sortOrder } $token
  if ($r3.ok) { W "re-save relative URL ($($rel.url)) -> OK (was a 422 validation error before the fix)" }
  else { W "re-save relative URL FAILED: $($r3.code) $($r3.raw)" }
} else { W "no relative-URL image on this product" }

# ---- 5) protocol-relative URL must still be rejected ----
$tgt = $product.images[0]
$r4 = Call "PATCH" "/admin/images/$($tgt.id)" @{ url = "//evil.example/x.png" } $token
W "protocol-relative url -> $($r4.code) (want 422)"
$r5 = Call "PATCH" "/admin/images/$($tgt.id)" @{ url = "not a url" } $token
W "garbage url            -> $($r5.code) (want 422)"

# ---- 6) negative / over-long values still rejected on the pointer fields ----
$r6 = Call "PATCH" "/admin/variants/$($variant.id)" @{ stock = -5 } $token
W "negative stock  -> $($r6.code) (want 422)"
$r7 = Call "PATCH" "/admin/variants/$($variant.id)" @{ extraPrice = -1 } $token
W "negative extra  -> $($r7.code) (want 422)"

# ---- 7) product stock stays in step after the variant patches ----
$after = Call "GET" "/admin/products/$($product.id)" $null $token
if ($after.ok) {
  $sum = ($after.body.variants | Measure-Object -Property stock -Sum).Sum
  W "product stock=$($after.body.stock) sum(variants)=$sum -> $(if ($after.body.stock -eq $sum) { 'IN STEP' } else { '** MISMATCH **' })"
}

W "DONE"
Get-Content $out -Encoding UTF8
