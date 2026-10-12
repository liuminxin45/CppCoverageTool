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
        string(name: 'WINDOWS_AGENT', defaultValue: 'windows', description: 'Windows x64 agent with Node.js, MSVC, Edge and OpenCppCoverage')
        string(name: 'RELEASE_TAG', defaultValue: 'v2.0.1', description: 'Immutable Git release tag to build and publish')
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
                    @{ tag = $env:RELEASE_TAG; commit = $commit; buildUrl = $env:BUILD_URL; node = (& node --version); capturedWith = 'CDP Page.captureScreenshot'; verifiedInstaller = $true } |
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
