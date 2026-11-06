param([Parameter(Mandatory)][string]$Installer)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Run the install smoke test only on an isolated GitHub Actions runner.' }

$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../../src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json
$installRoot = Join-Path ([IO.Path]::GetTempPath()) ('Layers installer smoke ' + [guid]::NewGuid().ToString('N'))
$appName = $config.mainBinaryName + '.exe'
$appPath = Join-Path $installRoot $appName
$app = $null
$installed = $false
try {
    # NSIS requires /D to be last and unquoted, including when the path has spaces.
    $setup = Start-Process -FilePath (Resolve-Path -LiteralPath $Installer).Path -ArgumentList "/S /D=$installRoot" -WindowStyle Hidden -PassThru
    if (-not $setup.WaitForExit(120000)) { $setup.Kill(); throw 'Installer timed out.' }
    if ($setup.ExitCode -ne 0) { throw "Installer returned $($setup.ExitCode)." }
    if (-not (Test-Path -LiteralPath $appPath -PathType Leaf)) { throw "Installed app missing: $appPath" }
    $installed = $true
    $shortcut = Join-Path ([Environment]::GetFolderPath('StartMenu')) ('Programs/' + $config.productName + '.lnk')
    if (-not (Test-Path -LiteralPath $shortcut)) { throw 'Start menu shortcut was not installed.' }
    $shell = New-Object -ComObject WScript.Shell
    if ($shell.CreateShortcut($shortcut).TargetPath -ne $appPath) { throw 'Start menu shortcut points to the wrong executable.' }
    $desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) ($config.productName + '.lnk')
    if (-not (Test-Path -LiteralPath $desktopShortcut)) { throw 'Desktop shortcut was not installed.' }
    if ($shell.CreateShortcut($desktopShortcut).TargetPath -ne $appPath) { throw 'Desktop shortcut points to the wrong executable.' }
    $app = Start-Process -FilePath $appPath -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    do {
        Start-Sleep -Milliseconds 250
        $app.Refresh()
        if ($app.HasExited) { throw "Installed app exited during startup with code $($app.ExitCode)." }
    } until ($app.MainWindowHandle -ne 0 -or [DateTime]::UtcNow -gt $deadline)
    if ($app.MainWindowHandle -eq 0) { throw 'Installed app did not open a main window.' }
    Start-Sleep -Seconds 2
    $app.Refresh()
    if ($app.HasExited) { throw 'Installed app closed immediately after opening.' }
    Write-Host 'Installed app launched successfully from a path containing spaces.'
} finally {
    if ($null -ne $app -and -not $app.HasExited) {
        [void]$app.CloseMainWindow()
        if (-not $app.WaitForExit(10000)) { $app.Kill(); $app.WaitForExit() }
    }
    if ($installed) {
        $uninstaller = Get-ChildItem -LiteralPath $installRoot -Filter '*uninstall*.exe' | Select-Object -First 1
        if ($null -eq $uninstaller) { throw 'Uninstaller was not packaged.' }
        $uninstall = Start-Process -FilePath $uninstaller.FullName -ArgumentList "/S _?=$installRoot" -WindowStyle Hidden -PassThru
        if (-not $uninstall.WaitForExit(60000)) { $uninstall.Kill(); throw 'Uninstaller timed out.' }
        if ($uninstall.ExitCode -ne 0) { throw "Uninstaller returned $($uninstall.ExitCode)." }
        if (Test-Path -LiteralPath $appPath) { throw 'Uninstaller left the application executable behind.' }
        if (Test-Path -LiteralPath $shortcut) { throw 'Uninstaller left the Start menu shortcut behind.' }
        if (Test-Path -LiteralPath $desktopShortcut) { throw 'Uninstaller left the desktop shortcut behind.' }
        Write-Host 'Uninstall verified.'
    }
}
