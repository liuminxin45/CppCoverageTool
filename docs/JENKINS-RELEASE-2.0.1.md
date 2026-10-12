# Verified Jenkins release: 2.0.1

Published on 2026-10-12 by [CppCoverageTool-Windows-Release #4](http://localhost:8080/job/CppCoverageTool-Windows-Release/4/), with result **SUCCESS** on `e-disk-agent`.

| Item | Verified value |
| --- | --- |
| Application tag | `v2.0.1` |
| Application commit | `c5f8f65348acbf6596e82eaafd8927db8c7171ec` |
| Pipeline revision | `d79b6928ac8695f0232cda233801160e2959da7b` (recorded in the Jenkins checkout log) |
| Runtime | Official checksum-identical managed Node.js `v24.19.0` |
| Installer SHA-256 | `929487689468c63e683830bfa829d64bf670bbab7e3fce69e5d6a07b77c9a30e` |

The archived installer was downloaded through the Jenkins artifact endpoint and hashed independently. Its SHA-256 matches the published `SHA256SUMS.txt`. The archived build metadata matches the application tag and commit above.

## Downloads

- [Windows x64 installer](http://localhost:8080/job/CppCoverageTool-Windows-Release/4/artifact/release/CppCoverageTool-2.0.1-windows-x64-setup.exe)
- [Portable ZIP](http://localhost:8080/job/CppCoverageTool-Windows-Release/4/artifact/release/CppCoverageTool-2.0.1-windows.zip)
- [SHA-256 checksums](http://localhost:8080/job/CppCoverageTool-Windows-Release/4/artifact/release/SHA256SUMS.txt)
- [Build metadata](http://localhost:8080/job/CppCoverageTool-Windows-Release/4/artifact/release/BUILD-METADATA.json)
- [Installer validation](http://localhost:8080/job/CppCoverageTool-Windows-Release/4/artifact/.verification/installer-smoke/result.json)
- [Real demo CDP capture record](http://localhost:8080/job/CppCoverageTool-Windows-Release/4/artifact/.verification/cdp-demo/capture.json)

The controller is local to this Windows machine; accessing these links requires Jenkins authentication.

## Passed release gates

The release build passed dependency preparation, shared UI integration, application tests, TypeScript and Vite build, browser checks in both themes/sizes, real C++ demo compilation and coverage, direct CDP screenshots, isolated portable-package validation, and Windows install/startup/running-upgrade/shutdown/uninstall/data-preservation checks. Installer, ZIP, checksums, metadata, six real screenshots and validation records were archived with Jenkins fingerprints.

The real-engine fixture test in the general Node test command is optional and was skipped in Jenkins; the subsequent real C++ demo/CDP stage executed OpenCppCoverage. The fixture's run/merge/cancellation checks also passed locally before publication.

Build #4's archived metadata has a null `pipelineCommit` field; its pipeline revision is verified from the checkout log above. The pipeline now captures the SCM return value explicitly for future build metadata. The published build's artifacts have not been rewritten.
