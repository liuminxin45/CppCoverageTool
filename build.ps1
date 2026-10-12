param([switch]$Package)
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
    if ($Package) {
        & npm.cmd run package
        if ($LASTEXITCODE -ne 0) { throw 'Packaging failed.' }
    }
} finally { Pop-Location }
