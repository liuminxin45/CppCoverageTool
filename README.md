# CoverageTool

CoverageTool is a Windows desktop GUI for running [OpenCppCoverage](https://github.com/OpenCppCoverage/OpenCppCoverage). It detects `OpenCppCoverage.exe` from `PATH` and helps configure a target executable, source root, optional PDB source-path substitution, output formats, excluded source paths, and COV merging.

## Features

- Detect `OpenCppCoverage.exe` from `PATH` and provide a GitHub download shortcut when it is missing.
- Configure the target executable, source directory, optional PDB source-path substitution, output directory, excluded sources, and extra OpenCppCoverage arguments.
- Infer the working directory from the selected target executable.
- Run coverage and generate HTML, binary COV, and Cobertura XML output.
- Merge existing `.cov` files into HTML, binary COV, and Cobertura XML reports.
- Switch the interface between English and Simplified Chinese at runtime.
- Persist settings with `QSettings`.

## Requirements

- Windows
- Visual Studio 2022 with the v143 toolset
- CMake 3.16 or newer
- Qt 5.12.12 x64 with CMake package files, for example `D:\Qt\Qt5.12.12\5.12.12\msvc2017_64`
- OpenCppCoverage installed separately and available through `PATH`

OpenCppCoverage, Qt, and other external tools are not bundled by this repository.

## Build

```powershell
.\build.ps1 -Configuration Debug -Platform x64
.\build.ps1 -Configuration Release -Platform x64
```

If Qt is not installed in a common path, pass it explicitly:

```powershell
.\build.ps1 -Configuration Release -Platform x64 -QtDir D:\Qt\Qt5.12.12\5.12.12\msvc2017_64
```

The repository uses CMake as the source build system. Generated Visual Studio files are written to `build/` and are not committed.

The repository does not bundle OpenCppCoverage, Qt, or other third-party binaries.

## Usage

1. Start `CoverageTool.exe`.
2. Confirm that OpenCppCoverage is detected. If it is not detected, use the download button and add it to `PATH`.
3. Select the target executable and source directory. The working directory is inferred from the target executable folder.
4. Optionally set the PDB source path, excluded sources, and extra OpenCppCoverage arguments.
5. Select an output directory.
6. Click `Run coverage`.

For merging, select a directory containing `.cov` files and click `Merge COV files`.
