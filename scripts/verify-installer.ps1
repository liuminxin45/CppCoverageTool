$ErrorActionPreference = 'Stop'
function Get-Sha256([string]$File) {
    $stream = [System.IO.File]::OpenRead($File)
    $hash = [System.Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $hash.Dispose() }
}
$project = Split-Path $PSScriptRoot -Parent
$version = (Get-Content -LiteralPath (Join-Path $project 'package.json') -Raw | ConvertFrom-Json).version
$setup = Join-Path $project "release\CppCoverageTool-$version-windows-x64-setup.exe"
$registry = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CppCoverageTool'
$shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'CppCoverageTool.lnk'
if ((Test-Path -LiteralPath $registry) -or (Test-Path -LiteralPath $shortcut)) { throw 'Installer smoke test requires a disposable profile without an existing CppCoverageTool installation.' }
$smokeRoot = [System.IO.Path]::GetFullPath((Join-Path $project '.verification\installer-smoke'))
$installed = Join-Path $smokeRoot ('app-' + [Guid]::NewGuid().ToString('N'))
$data = Join-Path $smokeRoot ('data-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $smokeRoot,$data | Out-Null
Remove-Item -LiteralPath (Join-Path $smokeRoot 'result.json') -Force -ErrorAction SilentlyContinue
[System.IO.File]::WriteAllText((Join-Path $data 'settings.json'), '{}')
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 47842)
$listener.Start()
$port = $listener.LocalEndpoint.Port
$listener.Stop()
$previousPort = $env:PORT
$previousData = $env:COVERAGE_DATA_DIRECTORY
$env:PORT = [string]$port
$env:COVERAGE_DATA_DIRECTORY = $data
$launcher = $null
$uninstalled = $false
function Install-Package {
    $process = Start-Process -FilePath $setup -ArgumentList '/VERYSILENT',('/DIR="' + $installed + '"') -WindowStyle Hidden -PassThru -Wait
    if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
}
function Wait-LocalService {
    for ($attempt = 0; $attempt -lt 100; $attempt++) {
        try {
            $request = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$port/api/state")
            $request.Proxy = $null; $request.Timeout = 1000
            $response = $request.GetResponse()
            $reader = [System.IO.StreamReader]::new($response.GetResponseStream())
            try { $state = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose(); $response.Dispose() }
            if ($state.version -eq $version -and $state.instanceId) { return $state }
        } catch { }
        if ($launcher.HasExited) { throw 'The installed launcher exited before becoming ready.' }
        Start-Sleep -Milliseconds 100
    }
    throw 'The installed service did not start.'
}
try {
    Install-Package
    foreach ($file in @('CppCoverageTool.exe','Uninstall.exe','runtime\node.exe','dist\index.html','server\index.mjs','.cppcoverage-installation')) {
        if (-not (Test-Path -LiteralPath (Join-Path $installed $file))) { throw "Missing installed file: $file" }
    }
    if ((Get-Sha256 (Join-Path $installed 'runtime\node.exe')) -ne '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237') { throw 'Installed runtime content changed.' }
    if ((Get-ItemProperty -LiteralPath $registry).InstallLocation -ne $installed) { throw 'Windows uninstall registration is missing.' }
    if (-not (Test-Path -LiteralPath $shortcut)) { throw 'Start menu shortcut is missing.' }
    $launcher = Start-Process -FilePath (Join-Path $installed 'CppCoverageTool.exe') -ArgumentList '--no-browser' -WindowStyle Hidden -PassThru
    $state = Wait-LocalService
    $client = [System.Net.WebClient]::new(); $client.Proxy = $null
    try { $html = $client.DownloadString("http://127.0.0.1:$port/") } finally { $client.Dispose() }
    if ($html -notlike '*CppCoverageTool*') { throw 'Installed frontend did not load.' }
    # Upgrading a running install must stop only its owned service and retain configuration.
    Install-Package
    if (-not $launcher.WaitForExit(15000)) { throw 'Upgrade did not stop the previous launcher.' }
    $launcher = Start-Process -FilePath (Join-Path $installed 'CppCoverageTool.exe') -ArgumentList '--no-browser' -WindowStyle Hidden -PassThru
    $state = Wait-LocalService
    [System.IO.File]::WriteAllText((Join-Path $installed 'keep-me.txt'), 'Untracked user file')
    $uninstall = Start-Process -FilePath (Join-Path $installed 'Uninstall.exe') -ArgumentList '/VERYSILENT' -WindowStyle Hidden -PassThru -Wait
    if ($uninstall.ExitCode -ne 0) { throw 'The uninstaller failed.' }
    for ($attempt = 0; $attempt -lt 150; $attempt++) {
        if (-not (Test-Path -LiteralPath (Join-Path $installed 'CppCoverageTool.exe')) -and -not (Test-Path -LiteralPath $registry) -and -not (Test-Path -LiteralPath $shortcut)) { break }
        Start-Sleep -Milliseconds 100
    }
    if (Test-Path -LiteralPath (Join-Path $installed 'CppCoverageTool.exe')) { throw 'Application files were not removed.' }
    if (-not $launcher.WaitForExit(15000)) { throw 'Uninstall did not stop the service.' }
    if ((Test-Path -LiteralPath $registry) -or (Test-Path -LiteralPath $shortcut)) { throw 'Windows registration or shortcut was not removed.' }
    if ([System.IO.File]::ReadAllText((Join-Path $data 'settings.json')) -ne '{}') { throw 'The installer changed user settings.' }
    if ([System.IO.File]::ReadAllText((Join-Path $installed 'keep-me.txt')) -ne 'Untracked user file') { throw 'The uninstaller removed an untracked user file.' }
    $uninstalled = $true
    @{ version = $version; install = 'passed'; bundledRuntime = 'passed'; frontend = 'passed'; upgradeWhileRunning = 'passed'; shutdown = 'passed'; uninstall = 'passed'; userSettingsPreserved = $true; untrackedFilesPreserved = $true } |
        ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $smokeRoot 'result.json')
    Write-Host 'Windows installer smoke test passed: install, startup, running upgrade, shutdown, uninstall and data preservation.'
} finally {
    if ($launcher -and -not $launcher.HasExited) {
        $stop = Start-Process -FilePath (Join-Path $installed 'CppCoverageTool.exe') -ArgumentList '--stop' -WindowStyle Hidden -PassThru -Wait
    }
    if (-not $uninstalled -and (Test-Path -LiteralPath (Join-Path $installed 'Uninstall.exe'))) {
        $cleanup = Start-Process -FilePath (Join-Path $installed 'Uninstall.exe') -ArgumentList '/VERYSILENT' -WindowStyle Hidden -PassThru -Wait
    }
    $env:PORT = $previousPort
    $env:COVERAGE_DATA_DIRECTORY = $previousData
    if ($uninstalled -and (Split-Path $installed -Parent) -eq $smokeRoot -and (Split-Path $installed -Leaf) -like 'app-*') { Remove-Item -LiteralPath $installed -Recurse -Force }
}
