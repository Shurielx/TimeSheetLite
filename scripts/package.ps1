param(
  [Parameter(Mandatory = $true)]
  [string]$Version,

  [string]$OutputPath = (Join-Path (Get-Location) 'dist\TimeSheetLite-windows.zip')
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$outputFile = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $outputFile
$stagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "timesheetlite-package-$([guid]::NewGuid())"

$filesToPackage = @(
  'index.html',
  'PRIVACY.md',
  'README.md',
  'css',
  'js',
  'Start-TimeSheetLite.cmd',
  'Start-TimeSheetLite.ps1',
  'Update-TimeSheetLite.ps1'
)

try {
  New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null

  foreach ($relativePath in $filesToPackage) {
    $sourcePath = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath)) {
      throw "Missing package file: $relativePath"
    }

    Copy-Item -LiteralPath $sourcePath -Destination $stagingDirectory -Recurse -Force
  }

  Set-Content -LiteralPath (Join-Path $stagingDirectory 'version.txt') -Value $Version -Encoding ascii
  Set-Content -LiteralPath (Join-Path $stagingDirectory 'README-Windows.txt') -Value @"
TimeSheetLite $Version

Start the application with Start-TimeSheetLite.cmd. The launcher checks GitHub
for a newer release and updates this folder before opening the app.

The app stores attendance data in this browser profile. Export a JSON backup
before moving the folder or clearing browser data.
"@ -Encoding ascii

  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
  if (Test-Path -LiteralPath $outputFile) {
    Remove-Item -LiteralPath $outputFile -Force
  }

  Compress-Archive -Path (Join-Path $stagingDirectory '*') -DestinationPath $outputFile -CompressionLevel Optimal
  Write-Output "Created $outputFile"
}
finally {
  if (Test-Path -LiteralPath $stagingDirectory) {
    Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
  }
}
