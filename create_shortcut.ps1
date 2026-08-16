$WshShell = New-Object -ComObject WScript.Shell

# Dynamically locate the script's directory (works wherever the repo is cloned)
$ScriptDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($ScriptDir)) {
    # Fallback to current working directory if run line-by-line in a terminal session
    $ScriptDir = Get-Location
}

# Path to the Desktop shortcut
$DesktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'AirShare.lnk')

# Create the shortcut pointing to the dynamic folder location
$Shortcut = $WshShell.CreateShortcut($DesktopPath)
$Shortcut.TargetPath = "cmd.exe"
$Shortcut.Arguments = "/c `"$ScriptDir\run.bat`""
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.IconLocation = "shell32.dll,149" # Green connectivity/network icon
$Shortcut.Description = "Launch AirShare High-Speed File Transfer"
$Shortcut.Save()

Write-Host "Success: AirShare shortcut created on Desktop pointing to $ScriptDir"
