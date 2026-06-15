# CoverageTool CMake build script.

param(
    [ValidateSet("Debug", "Release", "RelWithDebInfo", "MinSizeRel")]
    [string]$Configuration = "Release",

    [ValidateSet("x64")]
    [string]$Platform = "x64",

    [string]$BuildDir = "",

    [string]$QtDir = "",

    [switch]$Clean,

    [switch]$NoDeploy
)

$ErrorActionPreference = "Stop"

function Resolve-QtPrefix {
    param([string]$RequestedQtDir)

    $candidates = @()

    if (-not [string]::IsNullOrWhiteSpace($RequestedQtDir)) {
        $candidates += $RequestedQtDir
    }

    if (-not [string]::IsNullOrWhiteSpace($env:QTDIR)) {
        $candidates += $env:QTDIR
    }

    $candidates += @(
        "D:\Qt\Qt5.12.12\5.12.12\msvc2017_64",
        "E:\Qt\Qt5.12.12\5.12.12\msvc2017_64",
        "C:\Qt\Qt5.12.12\5.12.12\msvc2017_64"
    )

    foreach ($candidate in $candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }

        $qtConfig = Join-Path $candidate "lib\cmake\Qt5\Qt5Config.cmake"
        if (Test-Path $qtConfig) {
            return (Resolve-Path $candidate).Path
        }
    }

    throw "Qt 5.12 x64 was not found. Pass -QtDir <path-to-msvc2017_64> or set QTDIR."
}

function Assert-SafeBuildDirectory {
    param(
        [string]$RepositoryRoot,
        [string]$Directory
    )

    $resolvedRoot = (Resolve-Path $RepositoryRoot).Path.TrimEnd('\')
    $fullDirectory = [System.IO.Path]::GetFullPath($Directory).TrimEnd('\')

    if (-not $fullDirectory.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to clean a build directory outside the repository: $fullDirectory"
    }

    if ($fullDirectory -eq $resolvedRoot) {
        throw "Refusing to clean the repository root."
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($BuildDir)) {
    $BuildDir = Join-Path $scriptDir "build"
}

$cmake = (Get-Command cmake -ErrorAction Stop).Source
$qtPrefix = Resolve-QtPrefix -RequestedQtDir $QtDir
$deployValue = if ($NoDeploy) { "OFF" } else { "ON" }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CoverageTool CMake build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Repository : $scriptDir" -ForegroundColor Green
Write-Host "Build dir  : $BuildDir" -ForegroundColor Green
Write-Host "Config     : $Configuration" -ForegroundColor Green
Write-Host "Platform   : $Platform" -ForegroundColor Green
Write-Host "Qt prefix  : $qtPrefix" -ForegroundColor Green
Write-Host "Deploy Qt  : $deployValue" -ForegroundColor Green
Write-Host ""

if ($Clean -and (Test-Path $BuildDir)) {
    Assert-SafeBuildDirectory -RepositoryRoot $scriptDir -Directory $BuildDir
    Write-Host "Cleaning build directory: $BuildDir" -ForegroundColor Yellow
    Remove-Item -LiteralPath $BuildDir -Recurse -Force
}

$configureArgs = @(
    "-S", $scriptDir,
    "-B", $BuildDir,
    "-G", "Visual Studio 17 2022",
    "-A", $Platform,
    "-DCMAKE_PREFIX_PATH=$qtPrefix",
    "-DCOVERAGETOOL_RUN_WINDEPLOYQT=$deployValue"
)

Write-Host "Configuring..." -ForegroundColor Cyan
& $cmake @configureArgs
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Building..." -ForegroundColor Cyan
& $cmake --build $BuildDir --config $Configuration --parallel
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$exeFile = Join-Path $BuildDir "bin\$Configuration\CoverageTool.exe"
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Build succeeded." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
if (Test-Path $exeFile) {
    Write-Host "Executable: $exeFile" -ForegroundColor Green
}
