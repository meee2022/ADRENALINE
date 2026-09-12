$ErrorActionPreference = "SilentlyContinue"

$bridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$lockPath = Join-Path $bridgeDir "bridge.lock"
$statusPath = Join-Path $bridgeDir "status.json"
$launcherPath = Join-Path $bridgeDir "run-hidden.vbs"
$nowMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$alive = $false

if (Test-Path -LiteralPath $lockPath) {
  try {
    $lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
    $ageMs = $nowMs - [int64]$lock.beat
    if ($ageMs -ge 0 -and $ageMs -lt 120000) {
      $process = Get-Process -Id ([int]$lock.pid) -ErrorAction SilentlyContinue
      $alive = $null -ne $process
    }
  } catch {}
}

if ($alive) { exit 0 }

# A stale lock must not prevent recovery after a crash or forced shutdown.
Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue

if (Test-Path -LiteralPath $launcherPath) {
  Start-Process -FilePath "wscript.exe" -ArgumentList ('"' + $launcherPath + '"') -WorkingDirectory $bridgeDir -WindowStyle Hidden
  $status = @{
    ok = $true
    note = "Watchdog restarted the attendance bridge"
    at = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  } | ConvertTo-Json
  Set-Content -LiteralPath $statusPath -Value $status -Encoding UTF8
  exit 0
}

exit 1
