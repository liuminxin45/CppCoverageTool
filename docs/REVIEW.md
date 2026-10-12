# Version 2.0 review and validation

Reviewed and verified on Windows on 2026-10-12.

## Architecture and scope

The former Qt Widgets application combined forms, translation tables, process execution, filesystem traversal, argument parsing and settings in one class. Version 2.0 replaces it with a React workspace and a loopback-only Node.js service. Qt sources, resources, CMake configuration and deployment scripts have been removed. Shared controls come directly from the prepared `chatgpt-desktop-kit` distribution at revision `b5ea2bd312e9e9c007b84859d550314ddae4acb5`; no component source is vendored.

Coverage and merge are separate destinations in one horizontal navigation row. The main workspace owns vertical scrolling; the execution log has a bounded independent viewport. Optional filters use a disclosure instead of a second always-visible form. Save/reload duplication, separate merge-output commands and the hand-maintained language translation table were removed. Version 2.0 uses English interface copy, including About and README. Theme changes and workflow navigation retain drafts.

The report pipeline exports COV and Cobertura XML from OpenCppCoverage, then generates its own standalone HTML. It does not patch or inject code into the coverage engine. The static report uses the pinned library's semantic tokens and artifact-specific table/source geometry; it is not a second React application or a copy of the shared component implementation.

## Review findings addressed

| Finding | Result in 2.0 |
| --- | --- |
| The old argument splitter lost empty quoted arguments and did not validate unmatched quotes. | Arguments use validated JSON string arrays and direct process invocation without a shell. |
| Extra coverage options could override managed execution/export behavior. | Only documented filtering/refinement options are accepted; target arguments remain separate. |
| Recursive merge could read generated results from its output tree. | Output traversal is excluded, input-inside-output is rejected, symbolic links/junctions are skipped, and every output directory is unique. |
| Default executable-only module filtering was easy to miss when measuring DLL code. | Module patterns are editable and documented. |
| Source paths in real Cobertura output use a drive root plus relative filenames. | Source resolution supports XML roots, then enforces the configured source boundary and resolves filesystem aliases. |
| Browser requests could otherwise expose local process and file operations to another website. | The server binds to 127.0.0.1, checks Host and Origin, rejects cross-site requests, requires JSON and a custom header for mutations, and sends a restrictive application CSP. |
| Malformed/partial output could be mistaken for a successful report. | Process exit, report generation, completion, failure and cancellation are distinct states. XML/COV remain available after report failure. |
| Embedding source or filenames in HTML creates an injection boundary. | XML declarations/entities are rejected; embedded JSON escapes script delimiters, dynamic content uses textContent, and source is restricted to the chosen root. |
| Unbounded logs and recursive file collection could grow indefinitely. | Logs retain 256 KB; merge has a 1,000-file limit and a Windows command-length check. |
| A controlled About dialog had no native Trigger for reliable focus return. | The host explicitly returns focus to the actual About command after portal cleanup. |
| Document typography/theme ownership was missing in the first rendered integration. | The host applies semantic system-font typography and document theme, retaining the shared control/overlay styles. |

## Verification

- Eleven Node tests passed with the real-engine test enabled. Coverage included argument boundaries, merge traversal, XML parsing, report escaping, saved configuration, request-origin boundaries, concurrent execution, failed processes and bounded logs.
- A real C++ fixture was compiled with MSVC debug information. OpenCppCoverage 0.9.9.0 ran the default and alternate branches, produced COV/XML, merged both runs with increased covered-line totals, embedded matching source, and cancelled a sleeping target through process-tree termination.
- TypeScript checks and the production Vite build passed. The library integration checker verified the manifest pin, lockfile, installed revision, prepared distribution and removal of retired Qt paths.
- Browser probes passed in installed Microsoft Edge at 1920×1080 and 1280×800 in both themes. A 1.25 deviceScaleFactor probe simulated 125% scaling; native Windows display scaling was not changed.
- Observed application surfaces: coverage, merge, About, appearance select, saved-settings toast, input-validation errors, failed process/log output and missing-engine state. Checks covered retained drafts, disabled execution, Escape, focus return, horizontal overflow and computed input typography.
- The standalone report was opened through a file URL. Probes verified summary totals, filters, source escaping, next-uncovered navigation, uncovered-only lines, empty search, themes and dialog focus return.
- The release ZIP was extracted outside the source checkout. Its built assets, API, packaged XML dependencies, library tokens and custom-report generation passed an isolated smoke test. The production dependency audit reported no known vulnerabilities.
- Screenshots use synthetic test content. Full failure and scaling evidence is kept locally in `.verification/browser/`; public screenshots contain synthetic paths.

| Surface | Light | Dark |
| --- | --- | --- |
| Workspace | [1280px](screenshots/workspace-light-1280.png) | [1280px](screenshots/workspace-dark-1280.png) |
| Merge | [1280px](screenshots/merge-light-1280.png) | [1280px](screenshots/merge-dark-1280.png) |
| Report | [1280px](screenshots/report-light-1280.png) | [1280px](screenshots/report-dark-1280.png) |
| Source detail | [Uncovered lines](screenshots/source-light-1280.png) | Shares the report theme |

Reference: [the pinned UI library](https://github.com/liuminxin45/ChatGPT-Desktop-UI/tree/b5ea2bd312e9e9c007b84859d550314ddae4acb5). This is a utility adaptation of its controls and neutral visual language, not a claim of a complete ChatGPT client replica.

## Limits and migration

## Version 2.0.1 additions

The README now contains six real-run screenshots produced through direct CDP `Page.captureScreenshot` calls over Chromium's isolated pipe. A compiled three-file C++ demo produced 26/33 covered executable lines (78.8%) with readable source snapshots. The earlier synthetic screenshots remain available as UI regression references.

The Windows installer was built with the Windows .NET Framework compiler. Validation covered installation, verified bundled runtime contents, Windows registration/Start menu shortcut, frontend/service startup, an upgrade while running, orderly shutdown, uninstall, unchanged configuration and preserved untracked user files. The launcher checks a private per-instance shutdown token and only terminates its own process tree. It reuses a matching official Node.js binary in PATH when available, accommodating this machine's restriction on networking from new executable paths; the installer also contains the checksum-identical runtime for machines without Node.js.

Jenkins release stages and build provenance are defined in `Jenkinsfile` and `docs/JENKINS.md`. Actual Jenkins execution/publication remains dependent on the user's controller, job and Windows agent configuration.

## Earlier 2.0 migration limits

- Runtime and coverage execution require Windows, Node.js and a separately installed OpenCppCoverage. The release ZIP contains the built frontend and backend dependencies, not these external executables.
- Native path-picker dialogs and Explorer handoff are implemented through fixed Windows commands; they were not driven in the browser automation suite. Firefox and Chrome were not separately exercised.
- Qt registry settings are not imported. Paths need to be configured once after upgrading. Existing COV files remain usable; the latest run is held only for the service session.
- Reports describe line coverage. Cobertura `hits` values are preserved as reported by the engine; they should not be interpreted as precise execution frequency. Source must match the analyzed binary/PDB, especially when merging builds.
- Source embedding is optional and capped at 2 MB/file and 20 MB/report. XML input is capped at 64 MB. Reports may contain source code and local paths; review before sharing.
