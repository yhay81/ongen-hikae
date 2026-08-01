[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Read-ProjectFile([string]$RelativePath) {
    $Path = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Path)) { throw "Missing required file: $RelativePath" }
    return Get-Content -LiteralPath $Path -Raw
}

$Package = Read-ProjectFile "package.json"
$Wrangler = Read-ProjectFile "wrangler.jsonc"
$Worker = Read-ProjectFile "src\worker.tsx"
$Styles = Read-ProjectFile "public\styles.css"
$Common = Read-ProjectFile "public\common.js"
$Application = Read-ProjectFile "public\app.js"
$Core = Read-ProjectFile "public\app-core.js"
$Privacy = Read-ProjectFile "docs\privacy-boundary.md"

foreach ($Required in @(
    "public\og.png",
    "public\favicon.svg",
    "public\manifest.webmanifest",
    "public\robots.txt",
    "public\sw.js",
    "public\16a103f18dc448aeb04dc8c01f241e62.txt",
    "migrations\0001_product.sql",
    ".github\workflows\ci.yml"
)) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $Required))) { throw "Missing required file: $Required" }
}

if ($Package -notmatch '"hono"' -or $Package -notmatch 'vite-plus' -or $Package -match 'better-auth') { throw "Stack boundary is incorrect" }
if ($Wrangler -notmatch 'ongen-hikae\.yhay81\.com' -or $Wrangler -notmatch 'workers_dev"\s*:\s*false' -or $Wrangler -match 'TO_BE_CREATED') { throw "Cloudflare boundary is incomplete" }
if ($Worker -notmatch "script-src 'self'" -or $Worker -match 'unsafe-inline' -or $Worker -notmatch 'geolocation=\(\)' -or $Worker -notmatch 'no-referrer') { throw "Security header contract failed" }
if ($Worker -match '成功条件|市場スコア|公開実験|収益性|仮説') { throw "Meta language leaked into the product" }
if ($Styles -match '(?i)gradient' -or $Styles -notmatch 'clamp\(1\.7rem, 3\.4vw, 2\.2rem\)') { throw "Visual type or color contract failed" }
if ($Application -match 'innerHTML' -or $Application -notmatch 'textContent') { throw "Safe DOM rendering contract failed" }
if ($Core -match 'fetch\(|XMLHttpRequest|sendBeacon' -or $Common -match 'record-form|sourceUrl|creditLine') { throw "Local content boundary failed" }
if ($Privacy -notmatch '案件名、曲名・音名、作者、配布元、URL' -or $Privacy -notmatch '45日') { throw "Privacy documentation is incomplete" }
if ((Get-Item -LiteralPath (Join-Path $RepoRoot "public\og.png")).Length -lt 20000) { throw "OG image is unexpectedly small" }
if ([regex]::Matches($Worker, 'source: "https://').Count -ne 3) { throw "Official source baseline failed" }
if ([regex]::Matches($Worker, 'slug: "(dova-syndrome|bgmer|sound-effect-lab)"').Count -ne 3) { throw "Source route baseline failed" }
if ($Core -notmatch 'maxRecords = 200' -or $Core -notmatch 'daysSince\(record\.checkedOn, today\) > 90') { throw "Local record limit or review window failed" }
if ($Core -notmatch 'spreadsheetSafe' -or $Core -notmatch 'parseImport') { throw "Export or import safety contract failed" }

Write-Output "Product release contract is satisfied"
