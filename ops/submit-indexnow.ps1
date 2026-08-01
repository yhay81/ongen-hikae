[CmdletBinding()]
param([Parameter(Mandatory)][string]$BaseUrl)
$ErrorActionPreference = "Stop"
$Key = "16a103f18dc448aeb04dc8c01f241e62"
$NormalizedBaseUrl = $BaseUrl.TrimEnd("/")
$CacheBuster = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$Sitemap = Invoke-WebRequest -Uri "$NormalizedBaseUrl/sitemap.xml?v=$CacheBuster" -Headers @{ "Cache-Control" = "no-cache" }
$Urls = [regex]::Matches($Sitemap.Content, '<loc>([^<]+)</loc>') | ForEach-Object { $_.Groups[1].Value }
if ($Urls.Count -lt 1) { throw "Published sitemap contains no URLs" }
$Payload = @{
    host = ([uri]$NormalizedBaseUrl).Host
    key = $Key
    keyLocation = "$NormalizedBaseUrl/$Key.txt"
    urlList = @($Urls)
} | ConvertTo-Json -Depth 3
$Response = Invoke-WebRequest -Uri "https://api.indexnow.org/indexnow" -Method Post -ContentType "application/json; charset=utf-8" -Body $Payload
[ordered]@{
    submitted_at = (Get-Date).ToUniversalTime().ToString("o")
    service = ([uri]$NormalizedBaseUrl).Host
    status = $Response.StatusCode
    url_count = $Urls.Count
    urls = @($Urls)
} | ConvertTo-Json -Depth 3
