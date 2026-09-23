# AirShare - High-Speed Local File Transfer

AirShare is a web-based local file transfer utility designed to send videos, photos, documents, and text clipboard data between your phone (iOS or Android) and a PC at maximum local network speed, without using the internet or any cloud services.

---

## 🚀 Features

- **Extreme Local Speed**: Transfers files directly over your local Wi-Fi router. Standard 5GHz Wi-Fi can easily reach speeds between 30 MB/s to 90 MB/s+ depending on your router.
- **Apple-Style Liquid Glass UI**: Modern translucent glassmorphism aesthetics with dynamic mesh gradient backdrops, frosted acrylic panels, smooth pill navigation, and responsive mobile-first reflow.
- **100% Offline (Offline-First QR)**: The server generates the QR code locally as a Base64 data URL. No external CDNs are loaded, meaning the tool works flawlessly even without internet access.
- **Bi-directional Transfer**: Send files from your phone to your PC, and drag-and-drop or paste files from your PC to your phone.
- **Durable File Pasting**: Press `Ctrl+C` on any file or image on your PC (or select "Copy" on your phone) and press `Ctrl+V` on the page to upload it instantly.
- **Shared Clipboard**: Instantly share text, URLs, and notes between devices with clear "Copy" and "Clear" actions.
- **One-Click "Download All"**: Download all shared files simultaneously packaged as a single high-speed `.zip` archive on phone or PC on the fly without intermediate disk inflation.
- **Custom PC Download Folder**: Choose any destination folder on your PC for incoming transfers. Use the built-in Windows folder browser dialog or type a custom path—saved settings persist across server restarts in `config.json`.
- **Session File Privacy & Protection**: Only files transferred through AirShare appear in the "Shared Files" section. Pre-existing files in your PC's download directory remain completely private and are shielded from accidental "Clear All" deletion.
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
   - **Send Files**: Drag and drop any file into the portal, click the drop zone to browse, or paste files directly from your clipboard (`Ctrl + V`).
   - **Shared Clipboard**: Paste or write text, then click **"Send to other device"** to sync. Use **"Copy Text"** to copy to your system clipboard silently (no highlights) or **"Clear"** to wipe the clipboard on all devices.
   - **Download All**: Click **"Download All"** to download all shared files in one click as a `.zip` archive.
   - **Manage Files**: Click **"Clear All"** to wipe all shared files, or **"Open folder"** to reveal the active download folder in Windows Explorer.
   - **Change Download Folder (PC)**: In the left desktop panel, click **"Browse..."** to select any folder on your PC using the native Windows folder picker, or type/paste a custom path and click **"Save"**.

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
