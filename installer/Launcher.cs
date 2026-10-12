using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Security.Cryptography;
using System.Threading;
using System.Windows.Forms;

internal static class Launcher {
    private static Process service;
    private static NotifyIcon tray;
    private static Mutex mutex;
    private static string token;
    private static string url;
    private static bool exiting;
    private static readonly StringBuilder output = new StringBuilder();

    [STAThread]
    private static void Main(string[] args) {
        Application.EnableVisualStyles();
        int port;
        if (!int.TryParse(Environment.GetEnvironmentVariable("PORT") ?? "47831", out port) || port < 1 || port > 65535) {
            MessageBox.Show("PORT must be from 1 to 65535.", "CppCoverageTool"); return;
        }
        url = "http://127.0.0.1:" + port;
        if (Array.IndexOf(args, "--stop") >= 0) {
            using (EventWaitHandle stop = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\CppCoverageTool.Stop." + port)) { stop.Set(); }
            try {
                using (Mutex owner = Mutex.OpenExisting("Local\\CppCoverageTool.Desktop." + port)) {
                    try { if (owner.WaitOne(15000)) owner.ReleaseMutex(); } catch (AbandonedMutexException) { owner.ReleaseMutex(); }
                }
            } catch (WaitHandleCannotBeOpenedException) { }
            return;
        }
        bool created;
        mutex = new Mutex(true, "Local\\CppCoverageTool.Desktop." + port, out created);
        if (!created) { OpenBrowser(); mutex.Dispose(); return; }
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string node = ResolveNode(root);
        token = Guid.NewGuid().ToString("N");
        string instance = Guid.NewGuid().ToString("N");
        try {
            var start = new ProcessStartInfo(node, "\"" + Path.Combine(root, "server", "index.mjs") + "\"") {
                WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true, RedirectStandardInput = true
            };
            start.EnvironmentVariables["COVERAGE_LAUNCHER_TOKEN"] = token;
            start.EnvironmentVariables["COVERAGE_INSTANCE_ID"] = instance;
            service = new Process { StartInfo = start };
            service.OutputDataReceived += RecordOutput;
            service.ErrorDataReceived += RecordOutput;
            service.Start(); service.StandardInput.Close(); service.BeginOutputReadLine(); service.BeginErrorReadLine();
            bool ready = false;
            for (int attempt = 0; attempt < 100; attempt++) {
                if (service.HasExited) break;
                try {
                    using (var response = Request("/api/state", "GET").GetResponse())
                    using (var reader = new StreamReader(response.GetResponseStream())) {
                        if (reader.ReadToEnd().Contains("\"instanceId\":\"" + instance + "\"")) { ready = true; break; }
                    }
                } catch (WebException) { }
                Thread.Sleep(100);
            }
            if (!ready) throw new InvalidOperationException("The local service did not start. The port may already be in use.\n\n" + output.ToString());
            var menu = new ContextMenuStrip();
            menu.Items.Add("Open CppCoverageTool", null, delegate { OpenBrowser(); });
            menu.Items.Add("Open report folder", null, delegate {
                try { using (var response = Request("/api/open-output", "POST").GetResponse()) { } }
                catch (WebException) { MessageBox.Show("Complete a coverage run first.", "CppCoverageTool"); }
            });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Exit", null, delegate { Exit(); });
            Icon icon = SystemIcons.Application;
            string iconFile = Path.Combine(root, "resources", "app.ico");
            if (File.Exists(iconFile)) icon = new Icon(iconFile);
            tray = new NotifyIcon { Icon = icon, Text = "CppCoverageTool " + BuildConstants.Version, ContextMenuStrip = menu, Visible = true };
            tray.DoubleClick += delegate { OpenBrowser(); };
            using (var stop = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\CppCoverageTool.Stop." + port)) {
                var timer = new System.Windows.Forms.Timer { Interval = 250 };
                timer.Tick += delegate { if (stop.WaitOne(0) || service.HasExited) Exit(); };
                timer.Start();
                if (Array.IndexOf(args, "--no-browser") < 0) OpenBrowser();
                Application.Run();
                timer.Dispose();
            }
        } catch (Exception error) {
            StopService();
            if (Array.IndexOf(args, "--no-browser") >= 0) { Console.Error.WriteLine(error.Message); Environment.ExitCode = 1; }
            else MessageBox.Show(error.Message, "CppCoverageTool could not start", MessageBoxButtons.OK, MessageBoxIcon.Error);
        } finally {
            StopService();
            if (tray != null) { tray.Visible = false; tray.Dispose(); }
            if (service != null) service.Dispose();
            mutex.ReleaseMutex(); mutex.Dispose();
        }
    }

    private static string ResolveNode(string root) {
        // Reuse an already approved runtime only when its contents match the bundled official release.
        // This also supports managed Windows environments that restrict network access by executable location.
        string expected = "3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237";
        foreach (string directory in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator)) {
            try {
                if (directory.StartsWith("\\\\", StringComparison.Ordinal)) continue;
                string candidate = Path.Combine(directory.Trim('"'), "node.exe");
                if (!File.Exists(candidate)) continue;
                using (var input = File.OpenRead(candidate)) using (var hash = SHA256.Create()) {
                    if (BitConverter.ToString(hash.ComputeHash(input)).Replace("-", "").ToLowerInvariant() == expected) return candidate;
                }
            } catch (IOException) { } catch (UnauthorizedAccessException) { } catch (ArgumentException) { }
        }
        return Path.Combine(root, "runtime", "node.exe");
    }

    private static void RecordOutput(object sender, DataReceivedEventArgs args) {
        if (args.Data == null) return;
        lock (output) {
            output.AppendLine(args.Data); if (output.Length > 8192) output.Remove(0, output.Length - 8192);
            string testDirectory = Environment.GetEnvironmentVariable("COVERAGE_DATA_DIRECTORY");
            if (!string.IsNullOrEmpty(testDirectory)) {
                try { Directory.CreateDirectory(testDirectory); File.WriteAllText(Path.Combine(testDirectory, "launcher.log"), output.ToString()); } catch (IOException) { }
            }
        }
    }
    private static HttpWebRequest Request(string endpoint, string method) {
        var request = (HttpWebRequest)WebRequest.Create(url + endpoint);
        request.Proxy = null; request.Timeout = 1000; request.Method = method;
        if (method == "POST") {
            request.ContentType = "application/json";
            request.Headers["X-Coverage-Client"] = "1";
            request.Headers["X-Coverage-Session"] = token;
            byte[] body = Encoding.UTF8.GetBytes("{}"); request.ContentLength = body.Length;
            using (var stream = request.GetRequestStream()) stream.Write(body, 0, body.Length);
        }
        return request;
    }
    private static void OpenBrowser() {
        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
        catch (Exception error) { MessageBox.Show("Open " + url + " in your browser.\n" + error.Message, "CppCoverageTool"); }
    }
    private static void Exit() { if (exiting) return; exiting = true; StopService(); Application.Exit(); }
    private static void StopService() {
        if (service == null) return;
        try { if (service.HasExited) return; } catch (InvalidOperationException) { return; }
        try { using (var response = Request("/api/shutdown", "POST").GetResponse()) { } } catch (WebException) { }
        if (!service.WaitForExit(10000)) {
            // Terminate only this launcher's child tree; never match unrelated node.exe processes by name.
            using (var kill = Process.Start(new ProcessStartInfo("taskkill.exe", "/PID " + service.Id + " /T /F") { UseShellExecute = false, CreateNoWindow = true })) { kill.WaitForExit(); }
        }
    }
}
