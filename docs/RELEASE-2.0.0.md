# CppCoverageTool 2.0.0

CppCoverageTool now runs as a local web workspace. Qt has been replaced by React, a loopback-only Node.js service, and the pinned ChatGPT Desktop UI component library.

## Changes

- Separate coverage and merge workflows, compact advanced settings, light/dark/system themes and English About/documentation.
- Custom offline HTML reports with coverage summaries, searchable/sortable files, uncovered-line filters, source snapshots and line navigation. COV and Cobertura XML remain available.
- Validated process arguments, unique report folders, bounded live logs and process-tree cancellation.
- Merge-output exclusion, source-path boundary checks, safe report embedding and same-origin local API protection.

## Install

Download and extract `CppCoverageTool-2.0.0-windows.zip`, install Node.js 22.23.3+ (22.x) or 24.19.0+ (24.x) and OpenCppCoverage, then run `start.cmd`. No Qt, frontend build, npm installation or compiler is needed for the ZIP.

Qt settings are not imported; configure paths once after upgrading. Existing COV files can be merged. Reports include source snapshots when matching local sources are available. The report is for line coverage, not branch coverage.

SHA-256 checksums are provided in `SHA256SUMS.txt`. See README and `docs/REVIEW.md` for validation and runtime limits.
