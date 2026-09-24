using System.Configuration;
using System.Data;
using System.Windows;

namespace PrinterAgent.ConfigTool;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
    /// <summary>
    /// StartupUri (the default WPF way to open the main window) always
    /// shows it immediately — no hook to keep it hidden. Manual startup
    /// here is what lets "--tray" (used by the Windows startup entry
    /// WindowsServiceInstaller registers) launch straight into the tray
    /// icon without the window ever flashing on screen first.
    /// </summary>
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // Closing the window only hides it (see MainWindow.Window_Closing) —
        // the app must NOT shut down just because no window is visible;
        // only MainWindow's own "Sair" flow calls Shutdown() explicitly.
        ShutdownMode = ShutdownMode.OnExplicitShutdown;

        var startMinimized = e.Args.Contains("--tray", StringComparer.OrdinalIgnoreCase);
        var window = new MainWindow();
        MainWindow = window;
        if (!startMinimized)
        {
            window.Show();
        }
    }
}

