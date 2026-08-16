# AirShare - High-Speed Local File Transfer

AirShare is a web-based local file transfer utility designed to send videos, photos, documents, and text clipboard data between an iPhone (or Android phone) and a PC at maximum local network speed, without using the internet or any cloud services.

## 🚀 Features

- **Extreme Local Speed**: Transfers files directly over your local Wi-Fi router. Standard 5GHz Wi-Fi can easily reach speeds between 30 MB/s to 90 MB/s+ depending on your router.
- **100% Offline (Offline-First QR)**: The server generates the QR code locally as a Base64 data URL. No external CDNs are loaded, meaning the tool works flawlessly even without internet access.
- **Bi-directional Transfer**: Send files from your phone to your PC, and drag-and-drop or paste files from your PC to your phone.
- **Durable File Pasting**: Press `Ctrl+C` on any file or image on your PC (or select "Copy" on your phone) and press `Ctrl+V` on the page to upload it instantly.
- **Shared Clipboard**: Instantly share text, URLs, and notes between devices with clear "Copy" and "Clear" actions.
- **High-Speed Storage**: Streams files directly to disk chunk-by-chunk to prevent RAM congestion for large videos.
- **Real-Time Progress**: Displays active speed (MB/s), percentage complete, and ETA on both sender and receiver screens via WebSockets.

---

## 🛠️ Setup Instructions

### 1. Requirements
* **Node.js** (v18+) installed on your PC.
* PC and Phone connected to the **same Wi-Fi network (LAN)**.

### 2. Installation
Before launching the server for the first time, download the required dependencies:
1. Open a terminal (PowerShell, Command Prompt, or terminal emulator) in the project directory.
2. Run the install command:
   ```bash
   npm install
   ```
   *This downloads the lightweight dependencies (`express` for the web server, `multer` for direct-to-disk file uploads, `ws` for live progress WebSockets, and `qrcode` for offline code generation).*

## 🚦 How to Run

1. **Launch the Server**:
   Double-click the [`run.bat`](run.bat) script in the project folder, or run:
   ```bash
   npm start
   ```

2. **Connect your Phone**:
   - The server will print a QR code in the terminal and open your PC's browser to `http://localhost:3000`.
   - Open your phone's camera (iOS or Android) and scan the QR code to open the portal.

3. **Start Sharing**:
   - **Send Files**: Drag and drop any file into the portal, click the drop zone to browse, or paste files directly from your clipboard (`Ctrl + V`).
   - **Shared Clipboard**: Paste or write text, then click **"Send to other device"** to sync. Use **"Copy Text"** to copy to your system clipboard silently (no highlights) or **"Clear"** to wipe the clipboard on all devices.
   - **Manage Files**: Click **"Clear All"** on the files header to wipe all shared files from the PC, or click **"Open folder"** (PC only) to reveal the files in Windows Explorer.

---

## 🖥️ Creating a Windows Taskbar / Desktop Shortcut

To launch AirShare with a single click without opening a terminal window, a PowerShell script [`create_shortcut.ps1`](create_shortcut.ps1) has been provided. 

This script creates an **AirShare** shortcut on your Desktop with a custom networking icon.

### To Run the Script Manually:
1. Open PowerShell.
2. Run the script from the project folder:
   ```powershell
   powershell -ExecutionPolicy Bypass -File create_shortcut.ps1
   ```
3. Locate the **AirShare** shortcut on your Desktop. Drag and drop it onto your **Taskbar** or right-click and select **Pin to Start** for instant access.

*The script configuration is as follows:*
```powershell
$WshShell = New-Object -ComObject WScript.Shell
$ScriptDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($ScriptDir)) { $ScriptDir = Get-Location }
$DesktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), 'AirShare.lnk')
$Shortcut = $WshShell.CreateShortcut($DesktopPath)
$Shortcut.TargetPath = "cmd.exe"
$Shortcut.Arguments = "/c `"$ScriptDir\run.bat`""
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.IconLocation = "shell32.dll,149" # Green network icon
$Shortcut.Description = "Launch AirShare High-Speed File Transfer"
$Shortcut.Save()
```

---

## 🐧 Linux User Trade-offs & Porting

AirShare's core backend and web interfaces are fully compatible with Linux, but because the tool is customized for Windows out of the box, there are two minor trade-offs:

1. **Auto-Open Browser Command**:
   - *Windows code*: uses `start` command to launch the browser.
   - *Linux behavior*: the command will fail silently at startup. You will have to open your browser manually and navigate to `http://localhost:3000`.
2. **"Open folder" Command**:
   - *Windows code*: launches `explorer.exe` to open the uploads folder.
   - *Linux behavior*: clicking the "Open folder" button on a Linux host will do nothing because `explorer.exe` is not a Linux binary.

### How to Port the Code to Linux:
If you want to run this server on Linux, open [`server.js`](server.js) and make two small modifications:

1. **Change the file manager command** (around line 276):
   - Replace `explorer.exe` with `xdg-open` (or your file manager of choice, like `nautilus`):
   ```diff
   - exec(`explorer.exe "${winPath}"`, (err) => {
   + exec(`xdg-open "${uploadsDir}"`, (err) => {
   ```
2. **Change the startup browser command** (around line 308):
   - Replace `start` with `xdg-open` (or `open` on macOS):
   ```diff
   - exec(`start http://localhost:${PORT}`);
   + exec(`xdg-open http://localhost:${PORT}`);
   ```

---

## 🔒 Security

- All transfers occur strictly within your local network (LAN).
- No data is sent to external servers or cloud services.
- Safe offline storage on your local hardware.
