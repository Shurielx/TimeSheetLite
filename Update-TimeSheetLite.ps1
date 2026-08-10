param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDirectory,

  [Parameter(Mandatory = $true)]
  [string]$DestinationDirectory,

  [Parameter(Mandatory = $true)]
  [int]$ProcessId
)

$ErrorActionPreference = 'Stop'

try {
  Wait-Process -Id $ProcessId -Timeout 30 -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500

  $excludedNames = @('Start-TimeSheetLite.ps1', 'Update-TimeSheetLite.ps1')
  Get-ChildItem -LiteralPath $SourceDirectory -Force | Where-Object {
    $_.Name -notin $excludedNames
  } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $DestinationDirectory -Recurse -Force
  }

  Copy-Item -LiteralPath (Join-Path $SourceDirectory 'Start-TimeSheetLite.ps1') -Destination $DestinationDirectory -Force
  Copy-Item -LiteralPath (Join-Path $SourceDirectory 'Update-TimeSheetLite.ps1') -Destination $DestinationDirectory -Force
  Remove-Item -LiteralPath (Split-Path -Parent $SourceDirectory) -Recurse -Force
  Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', (Join-Path $DestinationDirectory 'Start-TimeSheetLite.ps1'),
    '-SkipUpdate'
  )
} catch {
  Write-Warning "Could not apply the update: $($_.Exception.Message)"
}
