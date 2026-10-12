pipeline {
    agent { label params.WINDOWS_AGENT }
    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '10'))
    }
    parameters {
        string(name: 'WINDOWS_AGENT', defaultValue: 'e-disk-agent', description: 'Windows x64 agent with MSVC, Edge and OpenCppCoverage')
        string(name: 'RELEASE_TAG', defaultValue: 'v2.0.1', description: 'Immutable Git release tag to build and publish')
    }
    environment {
        NODE_RELEASE_HOME = "${env.WORKSPACE}\\.ci-tools\\node-v24.19.0-win-x64"
        PATH = "${env.WORKSPACE}\\.ci-tools\\node-v24.19.0-win-x64;${env.PATH}"
    }
    stages {
        stage('Checkout release') {
            steps {
                checkout scm
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    if ($env:RELEASE_TAG -notmatch '^v[0-9]+[.][0-9]+[.][0-9]+$') { throw 'Invalid release tag.' }
                    git fetch --tags origin
                    if ($LASTEXITCODE -ne 0) { throw 'Could not fetch release tags.' }
                    git checkout --detach $env:RELEASE_TAG
                    if ($LASTEXITCODE -ne 0) { throw 'Release tag was not found.' }
                    $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
                    if ('v' + $version -ne $env:RELEASE_TAG) { throw 'Version does not match the release tag.' }
                '''
            }
        }
        stage('Pinned Node runtime') {
            steps {
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
                    $expected = '57f71ab3652e797d84acddc79c81cc9ff1c6ddb2a1974cdb83f00fee9bff4c73'
                    $tools = Join-Path $env:WORKSPACE '.ci-tools'
                    $archive = Join-Path $tools 'node-v24.19.0-win-x64.zip'
                    New-Item -ItemType Directory -Force -Path $tools | Out-Null
                    function Get-Sha256([string]$File) {
                        $stream = [IO.File]::OpenRead($File)
                        $hash = [Security.Cryptography.SHA256]::Create()
                        try { return [BitConverter]::ToString($hash.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
                        finally { $stream.Dispose(); $hash.Dispose() }
                    }
                    if (-not (Test-Path -LiteralPath $archive) -or (Get-Sha256 $archive) -ne $expected) {
                        Invoke-WebRequest -UseBasicParsing 'https://nodejs.org/dist/v24.19.0/node-v24.19.0-win-x64.zip' -OutFile $archive
                    }
                    if ((Get-Sha256 $archive) -ne $expected) { throw 'Official Node archive checksum does not match.' }
                    if (-not (Test-Path -LiteralPath (Join-Path $env:NODE_RELEASE_HOME 'node.exe'))) {
                        Add-Type -AssemblyName System.IO.Compression.FileSystem
                        [IO.Compression.ZipFile]::ExtractToDirectory($archive, $tools)
                    }
                    if ((Get-Sha256 (Join-Path $env:NODE_RELEASE_HOME 'node.exe')) -ne '3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237') { throw 'Pinned Node executable checksum does not match.' }
                    & node --version
                    if ($LASTEXITCODE -ne 0) { throw 'Pinned Node runtime is unavailable.' }
                    & npm.cmd --version
                    if ($LASTEXITCODE -ne 0) { throw 'Pinned npm runtime is unavailable.' }
                '''
            }
        }
        stage('Install and validate') {
            steps {
                bat 'npm ci'
                bat 'npm run check:ui'
                bat 'npm test'
                bat 'npm run build'
                bat 'npm run test:browser'
            }
        }
        stage('Real demo and CDP screenshots') {
            steps {
                powershell './scripts/build-demo.ps1'
                bat 'npm run screenshots:demo'
            }
        }
        stage('Windows release') {
            steps {
                bat 'npm run package'
                bat 'npm run test:package'
                powershell './scripts/build-installer.ps1'
                powershell './scripts/verify-installer.ps1'
                powershell '''
                    $ErrorActionPreference = 'Stop'
                    $commit = git rev-parse HEAD
                    if ($LASTEXITCODE -ne 0) { throw 'Could not read the release commit.' }
                    @{ tag = $env:RELEASE_TAG; commit = $commit; pipelineCommit = $env:GIT_COMMIT; buildUrl = $env:BUILD_URL; node = (& node --version); capturedWith = 'CDP Page.captureScreenshot'; verifiedInstaller = $true } |
                        ConvertTo-Json | Set-Content -Encoding UTF8 release/BUILD-METADATA.json
                '''
            }
        }
        stage('Publish release artifacts') {
            steps {
                archiveArtifacts artifacts: "release/CppCoverageTool-${params.RELEASE_TAG.substring(1)}-windows-x64-setup.exe,release/CppCoverageTool-${params.RELEASE_TAG.substring(1)}-windows.zip,release/SHA256SUMS.txt,release/BUILD-METADATA.json", fingerprint: true, onlyIfSuccessful: true
                archiveArtifacts artifacts: 'docs/screenshots/demo-*.png,.verification/cdp-demo/capture.json,.verification/installer-smoke/result.json', fingerprint: true, onlyIfSuccessful: true
            }
        }
    }
}
