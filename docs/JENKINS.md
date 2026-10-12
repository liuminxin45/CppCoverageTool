# Jenkins Windows release

The root `Jenkinsfile` builds an immutable release tag on a Windows x64 agent, validates the web application, compiles the C++ demo, captures real screenshots through CDP, builds a per-user Windows installer, tests installation/startup/shutdown/upgrade/uninstallation, and publishes fingerprinted artifacts through Jenkins.

## Job configuration

Create a Pipeline job with **Pipeline script from SCM**, repository `https://github.com/liuminxin45/CppCoverageTool.git`, branch `main`, script path `Jenkinsfile`. Use your Jenkins-managed Git credentials if required. This public repository and its pinned UI dependency can be read over HTTPS without adding credentials to source files.

Set `WINDOWS_AGENT` to the actual Windows agent label and `RELEASE_TAG` to `v2.0.1` (or a subsequent published release tag). The checkout verifies that the package version matches the tag. Failed validation prevents the publishing stage.

Managed machines may set `MANAGED_NODE_EXECUTABLE` to an already approved Node.js executable. Its SHA-256 must exactly match the pinned official 24.19.0 binary. Job-local forwarding commands use that executable with npm from the verified workspace distribution; no shared runtime is changed and executable-path network policies remain in force.

The agent needs:

- Windows x64 with .NET Framework 4.8 and Windows PowerShell.
- The pipeline provisions an official SHA-256-verified Node.js 24.19.0/npm distribution in its own workspace. It does not replace the agent's shared Node installation. The installer pins and verifies the same runtime.
- MSVC C++ build tools and matching Windows SDK, detectable through `vswhere`.
- OpenCppCoverage and Microsoft Edge.
- Access to GitHub and registry.npmjs.org. The installer build verifies the runtime against the official pinned SHA-256 and includes the Node.js license.
- A disposable user profile for installer smoke testing. The smoke test refuses to overwrite an existing registered CppCoverageTool installation.

## Published files

Successful builds expose these files under the Jenkins build's **Artifacts**:

- `CppCoverageTool-2.0.1-windows-x64-setup.exe` — per-user installer with bundled Node.js, Start menu shortcut, tray launcher and Windows uninstall registration.
- `CppCoverageTool-2.0.1-windows.zip` — portable package; requires external Node.js.
- `SHA256SUMS.txt` and `BUILD-METADATA.json` — file integrity, source commit and originating Jenkins build.
- Real demo screenshots and installer/CDP validation records.

The installer keeps settings and reports outside its application directory. OpenCppCoverage is installed separately. The build does not modify or bundle its executable.

The installer is unsigned unless your release process signs it separately. This repository does not embed a signing certificate or Jenkins API credential.

The pipeline definition is loaded from `main`; the application source is checked out at `RELEASE_TAG`. Build metadata records both commits so pipeline maintenance can validate an existing immutable application release.

The browser verification harness is retained from the pipeline revision before switching to the application tag. This lets synchronization fixes validate older immutable application releases without changing their runtime code; its provenance is the same recorded pipeline commit.

Actual publication requires a reachable Jenkins controller, a configured job and an available Windows agent. A checked-in Jenkinsfile alone is not evidence of a Jenkins release build.
