$WshShell = New-Object -ComObject WScript.Shell

$ScriptDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($ScriptDir)) {
    $ScriptDir = (Get-Location).Path
}

$DesktopPaths = @(
    [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'AirShare.lnk'),
    [System.IO.Path]::Combine($env:USERPROFILE, 'Desktop', 'AirShare.lnk'),
    [System.IO.Path]::Combine($env:USERPROFILE, 'OneDrive', 'Desktop', 'AirShare.lnk')
) | Select-Object -Unique

foreach ($DesktopPath in $DesktopPaths) {
    $ParentDir = [System.IO.Path]::GetDirectoryName($DesktopPath)
    if (Test-Path $ParentDir) {
        $Shortcut = $WshShell.CreateShortcut($DesktopPath)
        $Shortcut.TargetPath = "$env:ComSpec"
        $Shortcut.Arguments = "/c `"$ScriptDir\run.bat`""
        $Shortcut.WorkingDirectory = $ScriptDir
        $Shortcut.IconLocation = "shell32.dll,149"
        $Shortcut.Description = "Launch AirShare High-Speed File Transfer"
        $Shortcut.Save()
        Write-Host "Success: AirShare shortcut created at $DesktopPath"
    }
}
