# AirShare - High-Speed Local File Transfer

AirShare is a web-based local file transfer utility designed to send videos, photos, documents, and text clipboard data between your phone (iOS or Android) and a PC at maximum local network speed, without using the internet or any cloud services.

---

## 🚀 Features

- **Extreme Local Speed**: Transfers files directly over your local Wi-Fi router. Standard 5GHz Wi-Fi can easily reach speeds between 30 MB/s to 90 MB/s+ depending on your router.
- **Apple-Style Liquid Glass UI**: Modern translucent glassmorphism aesthetics with dynamic mesh gradient backdrops, frosted acrylic panels, smooth pill navigation, and responsive mobile-first reflow.
- **100% Offline & Instant First-Paint**: Zero external CDNs or remote font dependencies. Uses native system typography and server-side state hydration (`__INITIAL_DATA__`) for instant, lag-free loading even on Wi-Fi networks without internet access.
- **Bi-directional Transfer**: Send files seamlessly from your phone to your PC via native file picker sheets, and drag-and-drop or browse files on PC.
- **Shared Clipboard**: Instantly share text, URLs, and code snippets across devices with one-tap "Paste", "Copy Text", and auto-synchronization.
- **Hold, then Save (PC)**: Files sent to the PC are held in AirShare's private `uploads/` folder and listed under "Shared Files". Nothing is written to your chosen folder until you press **Save** on a file or **Save All to Folder**.
- **Download / Download All (Phone)**: Phones and tablets get **Download** and **Download All** (one streamed `.zip`, no temporary file on disk). The PC shows Save instead, chosen by device detection rather than screen width.
- **Custom PC Save Folder**: Choose any destination folder using the built-in Windows folder browser dialog or type a custom path. The setting persists across restarts in `config.json`. Switching folders never clears the Shared Files list, so files sent before you switch can simply be saved to the new folder.
- **Shared Files Privacy**: Only files sent through AirShare appear in "Shared Files". Pre-existing files in your save folder are never listed, served, or deleted. **Clear All** empties the list and discards unsaved held copies; files already saved to a folder are never touched.
- **Downloaded Checkmark**: A green tick appears beside a file once you have saved or downloaded it on that device (remembered per device in the browser).
- **Real-Time Progress**: Displays active speed (MB/s), percentage complete, and ETA on both sender and receiver screens via WebSockets.
- **Port Conflict & Zombie Process Recovery**: The launcher script automatically detects and frees stale port 3000 background instances before starting.

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
   *This downloads the lightweight dependencies (`express`, `multer`, `ws`, `qrcode`, and `archiver`).*

---

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
   - **Send Files**: Drag and drop any file into the portal on PC, or tap the drop zone on your phone to open the native file picker sheet.
   - **Shared Clipboard**: Type or paste text into the box and click **"Send"** (or use the one-click **"Paste"** button). Click **"Copy Text"** to copy to your system clipboard, or **"Clear"** to wipe the shared clipboard across all devices.
   - **Save Files (PC)**: Files sent from your phone appear under "Shared Files" and are held until you click **Save** on a file or **Save All to Folder**, which copies them into the selected save folder.
   - **Download Files (Phone)**: Tap **Download** on a file, or **Download All** for a single `.zip` archive.
   - **Manage Files**: Click **"Clear All"** to empty the list (unsaved held files are discarded; saved files stay put), or **"Open folder"** to reveal the save folder in Windows Explorer.
   - **Change Save Folder (PC)**: In the left desktop panel, click **"Browse..."** to select any folder on your PC using the native Windows folder picker, or type/paste a custom path and click **"Save"**. The Shared Files list is unaffected.

---

## 🖥️ Creating a Windows Taskbar / Desktop Shortcut

To launch AirShare with a single click without opening a terminal window, run the included PowerShell script [`create_shortcut.ps1`](create_shortcut.ps1):

1. Open PowerShell.
2. Run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File create_shortcut.ps1
   ```
3. Locate the **AirShare** shortcut on your Desktop. You can drag and drop it onto your **Taskbar** or right-click and select **Pin to Start** for instant access.

---

## 🔒 Security

- All transfers occur strictly within your local network (LAN).
- No data is sent to external servers or cloud services.
- Safe offline storage on your local hardware.
- PC-only administration endpoints (save to folder, change/reset save folder, folder browser, open folder, add by path) accept requests only from the PC itself (`localhost`); other devices on the network receive a 403.
- There is no login or PIN: anyone on your Wi-Fi who opens the portal can send files, see Shared Files, read or change the shared clipboard, and clear the list. Avoid running AirShare on public or untrusted networks.
