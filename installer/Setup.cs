using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Setup {
    private static readonly string DefaultRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "CppCoverageTool");
    [STAThread]
    private static int Main(string[] args) {
        bool silent = Array.Exists(args, value => value.Equals("/VERYSILENT", StringComparison.OrdinalIgnoreCase));
        string root = DefaultRoot;
        foreach (string value in args) if (value.StartsWith("/DIR=", StringComparison.OrdinalIgnoreCase)) root = value.Substring(5).Trim('"');
        bool success = false;
        if (silent) { try { Install(root); return 0; } catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; } }
        Application.EnableVisualStyles();
        var window = new Form { Text = "Install CppCoverageTool " + BuildConstants.Version, Width = 580, Height = 290, FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, StartPosition = FormStartPosition.CenterScreen };
        window.Font = new System.Drawing.Font("Segoe UI", 9);
        var title = new Label { Left = 24, Top = 24, Width = 520, Height = 30, Text = "CppCoverageTool " + BuildConstants.Version, Font = new System.Drawing.Font("Segoe UI", 14) };
        var description = new Label { Left = 24, Top = 64, Width = 520, Height = 40, Text = "Install for your Windows account. Includes Node.js and a Start menu shortcut.\nOpenCppCoverage is installed separately." };
        var directory = new TextBox { Left = 24, Top = 114, Width = 520, Text = root };
        var open = new CheckBox { Left = 24, Top = 153, Width = 360, Text = "Open CppCoverageTool after installation", Checked = true };
        var status = new Label { Left = 24, Top = 185, Width = 320, Height = 30 };
        var cancel = new Button { Left = 445, Top = 197, Width = 99, Text = "Cancel", DialogResult = DialogResult.Cancel };
        var install = new Button { Left = 337, Top = 197, Width = 99, Text = "Install" };
        install.Click += delegate {
            install.Enabled = false; cancel.Enabled = false; directory.Enabled = false;
            status.Text = "Installing…"; window.Refresh();
            try {
                Install(directory.Text); success = true;
                if (open.Checked) Process.Start(new ProcessStartInfo(Path.Combine(directory.Text, "CppCoverageTool.exe")) { UseShellExecute = true });
                MessageBox.Show("CppCoverageTool is installed. Use its system tray menu to exit the local service.", "Installation complete");
                window.Close();
            } catch (Exception error) { MessageBox.Show(error.Message, "Installation failed", MessageBoxButtons.OK, MessageBoxIcon.Error); status.Text = "Installation failed."; install.Enabled = true; cancel.Enabled = true; directory.Enabled = true; }
        };
        window.Controls.AddRange(new Control[] { title, description, directory, open, status, cancel, install });
        window.AcceptButton = install; window.CancelButton = cancel;
        Application.Run(window);
        return success ? 0 : 1;
    }

    private static void Install(string destination) {
        string root = Path.GetFullPath(destination);
        if (root == Path.GetPathRoot(root) || root == Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)) throw new InvalidOperationException("Choose a dedicated application directory.");
        string marker = Path.Combine(root, ".cppcoverage-installation");
        bool upgrade = File.Exists(marker) && File.ReadAllText(marker) == BuildConstants.AppId;
        if (Directory.Exists(root) && Directory.GetFileSystemEntries(root).Length > 0 && !upgrade) throw new InvalidOperationException("The selected folder is not an existing CppCoverageTool installation. Choose an empty folder.");
        if (upgrade && File.Exists(Path.Combine(root, "CppCoverageTool.exe"))) {
            using (var stop = Process.Start(new ProcessStartInfo(Path.Combine(root, "CppCoverageTool.exe"), "--stop") { UseShellExecute = false, CreateNoWindow = true })) { if (!stop.WaitForExit(20000)) throw new InvalidOperationException("Close CppCoverageTool before upgrading."); }
        }
        Directory.CreateDirectory(root);
        var installed = new List<string>();
        if (upgrade && File.Exists(Path.Combine(root, "installed-files.txt"))) installed.AddRange(File.ReadAllLines(Path.Combine(root, "installed-files.txt")));
        using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("CppCoverageTool.Package.zip"))
        using (var zip = new ZipArchive(stream, ZipArchiveMode.Read)) {
            string prefix = "CppCoverageTool-" + BuildConstants.Version + "-windows/";
            foreach (ZipArchiveEntry entry in zip.Entries) {
                string name = entry.FullName.Replace('\\', '/');
                if (!name.StartsWith(prefix, StringComparison.Ordinal)) throw new InvalidDataException("Unexpected archive root.");
                name = name.Substring(prefix.Length);
                if (name.Length == 0 || name.EndsWith("/")) continue;
                string file = Path.GetFullPath(Path.Combine(root, name));
                if (!file.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("An archive entry escapes the installation folder.");
                if (!installed.Contains(name)) installed.Add(name);
            }
            installed.Add(".cppcoverage-installation"); installed.Add("installed-files.txt");
            File.WriteAllText(marker, BuildConstants.AppId);
            File.WriteAllLines(Path.Combine(root, "installed-files.txt"), installed, Encoding.UTF8);
            foreach (ZipArchiveEntry entry in zip.Entries) {
                string name = entry.FullName.Replace('\\', '/');
                if (!name.StartsWith(prefix, StringComparison.Ordinal)) throw new InvalidDataException("Unexpected archive root.");
                name = name.Substring(prefix.Length);
                if (name.Length == 0 || name.EndsWith("/")) continue;
                string file = Path.GetFullPath(Path.Combine(root, name));
                if (!file.StartsWith(root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("An archive entry escapes the installation folder.");
                Directory.CreateDirectory(Path.GetDirectoryName(file));
                using (Stream input = entry.Open()) using (var output = File.Create(file)) input.CopyTo(output);
            }
        }
        string shortcut = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "CppCoverageTool.lnk");
        Directory.CreateDirectory(Path.GetDirectoryName(shortcut));
        Type shellType = Type.GetTypeFromProgID("WScript.Shell");
        object shell = Activator.CreateInstance(shellType);
        object link = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { shortcut });
        Type linkType = link.GetType();
        linkType.InvokeMember("TargetPath", BindingFlags.SetProperty, null, link, new object[] { Path.Combine(root, "CppCoverageTool.exe") });
        linkType.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, link, new object[] { root });
        linkType.InvokeMember("Save", BindingFlags.InvokeMethod, null, link, null);
        System.Runtime.InteropServices.Marshal.FinalReleaseComObject(link);
        System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell);
        using (RegistryKey key = Registry.CurrentUser.CreateSubKey(BuildConstants.RegistryKey)) {
            key.SetValue("DisplayName", "CppCoverageTool"); key.SetValue("DisplayVersion", BuildConstants.Version);
            key.SetValue("Publisher", "CppCoverageTool contributors"); key.SetValue("InstallLocation", root);
            key.SetValue("DisplayIcon", Path.Combine(root, "CppCoverageTool.exe"));
            key.SetValue("UninstallString", "\"" + Path.Combine(root, "Uninstall.exe") + "\"");
            key.SetValue("QuietUninstallString", "\"" + Path.Combine(root, "Uninstall.exe") + "\" /VERYSILENT");
            key.SetValue("URLInfoAbout", "https://github.com/liuminxin45/CppCoverageTool");
            key.SetValue("NoModify", 1, RegistryValueKind.DWord); key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
        }
    }
}
