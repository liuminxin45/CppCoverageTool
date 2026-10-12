using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class Uninstall {
    [STAThread]
    private static int Main(string[] args) {
        bool silent = Array.Exists(args, value => value.Equals("/VERYSILENT", StringComparison.OrdinalIgnoreCase));
        if (!silent && MessageBox.Show("Remove CppCoverageTool? Your settings and coverage reports will be kept.", "Uninstall CppCoverageTool", MessageBoxButtons.OKCancel) != DialogResult.OK) return 1;
        string root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        try {
            string marker = Path.Combine(root, ".cppcoverage-installation");
            if (!File.Exists(marker) || File.ReadAllText(marker) != BuildConstants.AppId) throw new InvalidOperationException("This is not a recognized installation.");
            using (var stop = Process.Start(new ProcessStartInfo(Path.Combine(root, "CppCoverageTool.exe"), "--stop") { UseShellExecute = false, CreateNoWindow = true })) {
                if (!stop.WaitForExit(20000)) throw new InvalidOperationException("Close CppCoverageTool before uninstalling.");
            }
            string helper = Path.Combine(root, "resources", "uninstall.ps1");
            string temporary = Path.Combine(Path.GetTempPath(), "cppcoverage-uninstall-" + Guid.NewGuid().ToString("N") + ".ps1");
            File.Copy(helper, temporary);
            var start = new ProcessStartInfo("powershell.exe", "-NoProfile -ExecutionPolicy Bypass -File \"" + temporary + "\" -InstallDirectory \"" + root + "\" -ParentProcessId " + Process.GetCurrentProcess().Id) { UseShellExecute = false, CreateNoWindow = true };
            Process.Start(start);
            return 0;
        } catch (Exception error) { if (!silent) MessageBox.Show(error.Message, "Uninstall failed"); return 1; }
    }
}
