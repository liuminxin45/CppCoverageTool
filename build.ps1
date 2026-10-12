param([switch]$Package, [switch]$Installer)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22.23.3+ or 24.19.0+ first.' }
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
    foreach ($task in @('check:ui', 'test', 'build')) {
        & npm.cmd run $task
        if ($LASTEXITCODE -ne 0) { throw "Validation failed: $task" }
    }
    if ($Package -or $Installer) {
        & npm.cmd run package
        if ($LASTEXITCODE -ne 0) { throw 'Packaging failed.' }
    }
    if ($Installer) {
        foreach ($task in @('installer', 'test:installer')) {
            & npm.cmd run $task
            if ($LASTEXITCODE -ne 0) { throw "Installer validation failed: $task" }
        }
    }
} finally { Pop-Location }
