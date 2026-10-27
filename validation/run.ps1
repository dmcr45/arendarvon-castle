param([Parameter(Mandatory = $true)][string]$Page, [int]$Budget = 600000)
# Runs an HTML test page in headless Edge and prints the text of <pre id="out">.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$query = ''; if ($Page -match '^(.*?)(\?.*)$') { $Page = $Matches[1]; $query = $Matches[2] }
$full = (Resolve-Path (Join-Path $here $Page)).Path
$url = 'file:///' + ($full -replace '\\', '/') + $query
$outFile = Join-Path $env:TEMP 'arendarvon_edge_out.txt'
$errFile = Join-Path $env:TEMP 'arendarvon_edge_err.txt'
$args = @('--headless=new', '--disable-gpu', '--no-first-run', "--user-data-dir=$env:TEMP\arendarvon-validation-edge",
          "--virtual-time-budget=$Budget", '--allow-file-access-from-files', '--dump-dom', $url)
$p = Start-Process -FilePath 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -ArgumentList $args `
     -RedirectStandardOutput $outFile -RedirectStandardError $errFile -PassThru -Wait
$dom = Get-Content $outFile -Raw
if ($dom -match '(?s)<pre id="out">(.*?)</pre>') { [System.Net.WebUtility]::HtmlDecode($Matches[1]) }
else { "NO OUTPUT ELEMENT. exit=$($p.ExitCode)"; $dom; Get-Content $errFile }

