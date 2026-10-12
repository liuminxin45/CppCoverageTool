# CppCoverageTool 2.0.1

This release adds a Windows installer, real coverage screenshots and a Jenkins release pipeline to the 2.0 web workspace.

- Per-user x64 installer with the official checksum-verified Node.js 24.19.0 runtime, Start menu shortcut, tray launcher and Windows uninstall entry.
- Safe shutdown of the launcher's own service and coverage process tree during exit, upgrade and uninstall. Configuration, reports and untracked user files are preserved.
- A C++ demo with three source files, compiled with matching PDBs and run by OpenCppCoverage. README screenshots show actual 78.8% line coverage and source details.
- Direct CDP `Page.captureScreenshot` capture over an isolated Chromium pipe, without native desktop automation.
- A Jenkinsfile that validates a release tag, captures the real demo, builds/tests the installer and publishes fingerprinted artifacts and source/build metadata.

Run `CppCoverageTool-2.0.1-windows-x64-setup.exe`, then start CppCoverageTool from the Start menu. OpenCppCoverage must be installed separately. The portable ZIP still requires external Node.js. Installers are unsigned; verify the SHA-256 before installation.

The Windows installer was published by local Jenkins build #4 with result SUCCESS. See [the verified publication record](JENKINS-RELEASE-2.0.1.md) for artifact links, source revision, checksums and passed release gates.
