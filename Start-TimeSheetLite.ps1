param(
  [switch]$SkipUpdate
)

$ErrorActionPreference = 'Stop'
$repo = 'Shurielx/TimeSheetLite'
$assetName = 'TimeSheetLite-windows.zip'
$root = (Resolve-Path (Join-Path $PSScriptRoot '.')).Path
$versionFile = Join-Path $root 'version.txt'
$localVersion = if (Test-Path -LiteralPath $versionFile) {
  (Get-Content -LiteralPath $versionFile -Raw).Trim()
} else {
  '0.0.0'
}

function ConvertTo-Version([string]$Value) {
  $cleanValue = $Value.Trim() -replace '^v', ''
  try {
    return [version]$cleanValue
  } catch {
    return [version]'0.0.0'
  }
}

function Get-LatestRelease {
  $apiUrl = "https://api.github.com/repos/$repo/releases/latest"
  return Invoke-RestMethod -Uri $apiUrl -Headers @{ 'User-Agent' = 'TimeSheetLite-Updater' } -TimeoutSec 8
}

function Start-Updater([string]$SourceDirectory) {
  $updater = Join-Path $SourceDirectory 'Update-TimeSheetLite.ps1'
  $arguments = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $updater,
    '-SourceDirectory', $SourceDirectory,
    '-DestinationDirectory', $root,
    '-ProcessId', $PID
  )
  Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden
}

if (-not $SkipUpdate) {
  try {
    $release = Get-LatestRelease
    $latestVersion = ConvertTo-Version $release.tag_name
    $currentVersion = ConvertTo-Version $localVersion
    $asset = @($release.assets) | Where-Object { $_.name -eq $assetName } | Select-Object -First 1

    if ($asset -and $latestVersion -gt $currentVersion) {
      $downloadDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "timesheetlite-update-$([guid]::NewGuid())"
      New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
      $archivePath = Join-Path $downloadDirectory $assetName
      $extractPath = Join-Path $downloadDirectory 'extracted'
      Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archivePath -Headers @{ 'User-Agent' = 'TimeSheetLite-Updater' } -TimeoutSec 60
      Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath -Force
      Start-Updater -SourceDirectory $extractPath
      exit 0
    }
  } catch {
    Write-Warning "Could not check for updates: $($_.Exception.Message)"
  }
}

Start-Process -FilePath (Join-Path $root 'index.html')
