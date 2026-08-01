[CmdletBinding()]
param([switch]$Local)
$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Wrangler = Join-Path $RepoRoot "node_modules\.bin\wrangler.cmd"
$Target = if ($Local) { "--local" } else { "--remote" }
$Sql = (Get-Content (Join-Path $PSScriptRoot "product-metrics.sql")) -join " "
$Output = & $Wrangler d1 execute ongen-hikae $Target --json --command $Sql
if ($LASTEXITCODE -ne 0) { throw "D1 metrics query failed" }
$Row = ((($Output -join [Environment]::NewLine) | ConvertFrom-Json)[0]).results[0]
$Visitors = [int]$Row.visitors
function Get-Percent([int]$Numerator, [int]$Denominator) {
    if ($Denominator -eq 0) { return $null }
    return [Math]::Round(($Numerator / $Denominator) * 100, 1)
}
[ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    service = "ongen-hikae"
    environment = if ($Local) { "local" } else { "production" }
    funnel = [ordered]@{
        visitors = $Visitors
        record_users = [int]$Row.record_users
        records_added = [int]$Row.records_added
        credit_users = [int]$Row.credit_users
        credits_copied = [int]$Row.credits_copied
        csv_users = [int]$Row.csv_users
        csv_exports = [int]$Row.csv_exports
        backup_users = [int]$Row.backup_users
        backups = [int]$Row.backups
        source_users = [int]$Row.source_users
        source_opens = [int]$Row.source_opens
        returned = [int]$Row.returned
        visitors_7d = [int]$Row.visitors_7d
        qa_rows = [int]$Row.qa_rows
    }
    rates = [ordered]@{
        record_percent = Get-Percent ([int]$Row.record_users) $Visitors
        output_percent = Get-Percent ([int]($Row.credit_users + $Row.csv_users)) $Visitors
        source_percent = Get-Percent ([int]$Row.source_users) $Visitors
    }
} | ConvertTo-Json -Depth 4
