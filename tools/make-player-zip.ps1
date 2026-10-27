# Builds the zip attached to a GitHub release: just what someone needs to play.
# The harness, the reference listings and the disc image stay in the repository.
#
#   powershell -ExecutionPolicy Bypass -File tools\make-player-zip.ps1
#
# (On macOS or Linux, from the repository root, the equivalent is:
#  zip play-arendarvon-castle-1.0.0.zip arendarvon-engine.js arendarvon.html arendarvon.js README.md LICENSE)

param([string]$Version = "1.0.0")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$files = "arendarvon-engine.js", "arendarvon.html", "arendarvon.js", "README.md", "LICENSE"

$dist = Join-Path $root "dist"
$stage = Join-Path $dist "arendarvon-castle-$Version"
$zip = Join-Path $dist "play-arendarvon-castle-$Version.zip"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }
New-Item -ItemType Directory -Force $stage | Out-Null

foreach ($f in $files) {
    $p = Join-Path $root $f
    if (-not (Test-Path $p)) { throw "missing: $f" }
    Copy-Item $p $stage
}

Compress-Archive -Path $stage -DestinationPath $zip -CompressionLevel Optimal
Remove-Item $stage -Recurse -Force

$kb = [math]::Round((Get-Item $zip).Length / 1KB)
Write-Host "built $zip ($kb KB, $($files.Count) files)"
