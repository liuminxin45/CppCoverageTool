param([ValidateSet('file', 'folder')][string]$Kind)
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
if ($Kind -eq 'file') {
    $dialog = [System.Windows.Forms.OpenFileDialog]::new()
    $dialog.Filter = 'Executable files (*.exe)|*.exe'
    $dialog.Title = 'Select target executable'
} else {
    $dialog = [System.Windows.Forms.FolderBrowserDialog]::new()
    $dialog.Description = 'Select a local directory'
}
try {
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        if ($Kind -eq 'file') { [Console]::Write($dialog.FileName) }
        else { [Console]::Write($dialog.SelectedPath) }
    }
} finally { $dialog.Dispose() }
