param([string]$NodeExecutable, [string]$NodeLicense)
$ErrorActionPreference = 'Stop'
function Get-Sha256([string]$File) {
    $stream = [System.IO.File]::OpenRead([System.IO.Path]::GetFullPath($File))
    $hash = [System.Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $hash.Dispose() }
}
$project = Split-Path $PSScriptRoot -Parent
$version = (Get-Content -LiteralPath (Join-Path $project 'package.json') -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Installer version must have three numeric parts.' }
$package = Join-Path $project "release\CppCoverageTool-$version-windows"
if (-not (Test-Path -LiteralPath (Join-Path $package 'dist\index.html'))) { throw 'Run npm run package before building the installer.' }
$build = Join-Path $project '.verification\installer-build'
New-Item -ItemType Directory -Force -Path $build,(Join-Path $package 'runtime') | Out-Null
$runtimeHash = '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'
if (-not $NodeExecutable) { $NodeExecutable = (Get-Command node.exe).Source }
if ((Get-Sha256 $NodeExecutable) -ne $runtimeHash) {
    $NodeExecutable = Join-Path $build 'node.exe'
    Invoke-WebRequest 'https://nodejs.org/dist/v24.19.0/win-x64/node.exe' -OutFile $NodeExecutable
}
if ((Get-Sha256 $NodeExecutable) -ne $runtimeHash) { throw 'Bundled Node.js checksum does not match the pinned official release.' }
Copy-Item -LiteralPath $NodeExecutable -Destination (Join-Path $package 'runtime\node.exe')
if (-not $NodeLicense) {
    $NodeLicense = Join-Path $build 'node-LICENSE'
    Invoke-WebRequest 'https://raw.githubusercontent.com/nodejs/node/v24.19.0/LICENSE' -OutFile $NodeLicense
}
Copy-Item -LiteralPath $NodeLicense -Destination (Join-Path $package 'resources\node-LICENSE')
Copy-Item -LiteralPath (Join-Path $project 'installer\uninstall.ps1') -Destination (Join-Path $package 'resources\uninstall.ps1')
Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::new((Join-Path $project 'public\icon.png'))
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$iconPath = Join-Path $package 'resources\app.ico'
$iconStream = [System.IO.File]::Create($iconPath)
try { $icon.Save($iconStream) } finally { $iconStream.Dispose(); $icon.Dispose(); $bitmap.Dispose() }
$constants = Join-Path $build 'BuildConstants.cs'
[System.IO.File]::WriteAllText($constants, '[assembly:System.Reflection.AssemblyTitle("CppCoverageTool")][assembly:System.Reflection.AssemblyVersion("' + $version + '.0")][assembly:System.Reflection.AssemblyFileVersion("' + $version + '.0")] internal static class BuildConstants { public const string Version = "' + $version + '"; public const string AppId = "47a584ab-8dc2-49ed-aedb-c3446d715599"; public const string RegistryKey = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\CppCoverageTool"; }')
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$common = @('/nologo','/target:winexe','/platform:x64',('/win32icon:' + $iconPath),'/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll')
& $compiler @common ('/out:' + (Join-Path $package 'CppCoverageTool.exe')) (Join-Path $project 'installer\Launcher.cs') $constants
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
& $compiler @common ('/out:' + (Join-Path $package 'Uninstall.exe')) (Join-Path $project 'installer\Uninstall.cs') $constants
if ($LASTEXITCODE -ne 0) { throw 'Uninstaller compilation failed.' }
$archive = Join-Path $build 'installer-runtime.zip'
Compress-Archive -LiteralPath $package -DestinationPath $archive -Force
$setup = Join-Path $project "release\CppCoverageTool-$version-windows-x64-setup.exe"
& $compiler @common '/reference:System.IO.Compression.dll' '/reference:System.IO.Compression.FileSystem.dll' ('/resource:' + $archive + ',CppCoverageTool.Package.zip') ('/out:' + $setup) (Join-Path $project 'installer\Setup.cs') $constants
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
$checksums = Join-Path $project 'release\SHA256SUMS.txt'
$entries = Get-ChildItem -LiteralPath (Join-Path $project 'release') -File | Where-Object { $_.Name -like "CppCoverageTool-$version-*" -and $_.Extension -in '.zip','.exe' } | Sort-Object Name | ForEach-Object { (Get-Sha256 $_.FullName) + '  ' + $_.Name }
[System.IO.File]::WriteAllLines($checksums, $entries)
Write-Host "Created $setup"
