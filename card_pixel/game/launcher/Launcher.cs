using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

internal static class Launcher
{
    private const string Title = "다음은 너";

    [STAThread]
    private static void Main()
    {
        string directory = AppDomain.CurrentDomain.BaseDirectory;
        string besideLauncher = Path.Combine(directory, "Relaymare.html");
        string inDist = Path.GetFullPath(Path.Combine(directory, "..", "dist", "Relaymare.html"));
        string html = File.Exists(besideLauncher) ? besideLauncher : inDist;

        if (!File.Exists(html))
        {
            MessageBox.Show("게임 파일 Relaymare.html을 찾을 수 없습니다.\n\n확인한 위치\n" +
                besideLauncher + "\n" + inDist, Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        try
        {
            OpenGame(html);
        }
        catch (Exception error)
        {
            MessageBox.Show("게임을 열 수 없습니다.\n\n" + error.Message,
                Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static void OpenGame(string html)
    {
        string programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string fileUrl = new Uri(html).AbsoluteUri;

        if (TryOpenApp(programFiles, programFilesX86, localAppData,
            @"Google\Chrome\Application\chrome.exe", "Chrome", fileUrl)) return;
        if (TryOpenApp(programFilesX86, programFiles, localAppData,
            @"Microsoft\Edge\Application\msedge.exe", "Edge", fileUrl)) return;

        Process.Start(new ProcessStartInfo(html) { UseShellExecute = true });
    }

    private static bool TryOpenApp(string firstFolder, string secondFolder, string localAppData,
        string relativeExe, string browser, string fileUrl)
    {
        foreach (string folder in new[] { firstFolder, secondFolder, localAppData })
        {
            if (String.IsNullOrEmpty(folder)) continue;
            string executable = Path.Combine(folder, relativeExe);
            if (!File.Exists(executable)) continue;

            string profile = Path.Combine(localAppData, "Relaymare", "browser", browser);
            Directory.CreateDirectory(profile);
            // The game has its own browser profile, so skip the new-profile welcome and default-browser prompts.
            string arguments = "--app=\"" + fileUrl + "\" --window-size=430,900 --no-first-run --no-default-browser-check" +
                " --user-data-dir=\"" + profile + "\"";
            Process.Start(new ProcessStartInfo(executable, arguments) { UseShellExecute = false });
            return true;
        }

        return false;
    }
}
