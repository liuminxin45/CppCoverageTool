param([string]$OutputDirectory = '.verification\coverage-demo')
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$output = [System.IO.Path]::GetFullPath((Join-Path $project $OutputDirectory))
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path -LiteralPath $vswhere)) { throw 'Install Visual Studio C++ Build Tools to compile the demo.' }
$installation = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $installation) { throw 'No MSVC x64 compiler was found.' }
$vcvars = Join-Path $installation 'VC\Auxiliary\Build\vcvars64.bat'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$sources = @('main.cpp', 'pricing.cpp', 'inventory.cpp') | ForEach-Object { '"' + (Join-Path $project "examples\coverage-demo\$_") + '"' }
$commands = @('@echo off', ('call "' + $vcvars + '"'), 'if errorlevel 1 exit /b 1', 'cd /d "%~dp0"', ('cl /nologo /Zi /Od /EHsc /Fe:CoverageDemo.exe /Fd:CoverageDemo.pdb ' + ($sources -join ' ') + ' /link /DEBUG /PDB:CoverageDemo.pdb'), 'exit /b %errorlevel%')
$script = Join-Path $output 'compile.cmd'
[System.IO.File]::WriteAllLines($script, $commands)
& cmd.exe /d /c $script
if ($LASTEXITCODE -ne 0) { throw 'The demo build failed.' }
Write-Host "Built $(Join-Path $output 'CoverageDemo.exe')"
