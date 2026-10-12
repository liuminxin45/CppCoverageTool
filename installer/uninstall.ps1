param([Parameter(Mandatory)][string]$InstallDirectory, [Parameter(Mandatory)][int]$ParentProcessId)
$ErrorActionPreference = 'Stop'
$target = [System.IO.Path]::GetFullPath($InstallDirectory).TrimEnd('\')
$marker = Join-Path $target '.cppcoverage-installation'
if ($target -eq [System.IO.Path]::GetPathRoot($target).TrimEnd('\') -or -not (Test-Path -LiteralPath $marker)) { throw 'Invalid installation directory.' }
if ([System.IO.File]::ReadAllText($marker) -ne '47a584ab-8dc2-49ed-aedb-c3446d715599') { throw 'Installation identity does not match.' }
Wait-Process -Id $ParentProcessId -ErrorAction SilentlyContinue
$files = [System.IO.File]::ReadAllLines((Join-Path $target 'installed-files.txt'))
$directories = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($relative in $files) {
    $file = [System.IO.Path]::GetFullPath((Join-Path $target $relative))
    if (-not $file.StartsWith($target + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Uninstall manifest escapes the installation directory.' }
    $parent = Split-Path $file -Parent
    while ($parent -ne $target -and $parent.StartsWith($target + '\', [System.StringComparison]::OrdinalIgnoreCase)) { [void]$directories.Add($parent); $parent = Split-Path $parent -Parent }
    if (Test-Path -LiteralPath $file -PathType Leaf) { Remove-Item -LiteralPath $file -Force }
}
foreach ($directory in ($directories | Sort-Object Length -Descending)) {
    if ((Test-Path -LiteralPath $directory -PathType Container) -and [System.IO.Directory]::GetFileSystemEntries($directory).Length -eq 0) { Remove-Item -LiteralPath $directory }
}
if ([System.IO.Directory]::GetFileSystemEntries($target).Length -eq 0) { Remove-Item -LiteralPath $target }
$registry = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CppCoverageTool'
if ((Get-ItemProperty -LiteralPath $registry -ErrorAction SilentlyContinue).InstallLocation -eq $target) { Remove-Item -LiteralPath $registry }
$shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'CppCoverageTool.lnk'
if (Test-Path -LiteralPath $shortcut) {
    $shell = New-Object -ComObject WScript.Shell
    if ($shell.CreateShortcut($shortcut).TargetPath -eq (Join-Path $target 'CppCoverageTool.exe')) { Remove-Item -LiteralPath $shortcut }
}
Remove-Item -LiteralPath $PSCommandPath
