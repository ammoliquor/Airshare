const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const archiver = require('archiver');
const { exec } = require('child_process');

// Helper to instantiate zip archive across archiver versions (v7 vs v8+)
function createZipArchive(options) {
  if (typeof archiver === 'function') {
    return archiver('zip', options);
  }
  if (archiver && archiver.ZipArchive) {
    return new archiver.ZipArchive(options);
  }
  throw new Error('Unsupported archiver module structure');
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');
const SHARED_FILES_MANIFEST = path.join(__dirname, 'shared_files.json');

// Default download folder is the PC's native Downloads folder
function getDefaultDownloadDir() {
  const homeDownloads = path.join(os.homedir(), 'Downloads');
  if (fs.existsSync(homeDownloads)) {
    return homeDownloads;
  }
  return path.join(__dirname, 'uploads');
}

const DEFAULT_DOWNLOAD_DIR = getDefaultDownloadDir();

// Helper to ensure a directory exists synchronously
function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Load configuration or fall back to default
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (data.downloadDir && typeof data.downloadDir === 'string') {
        const resolved = path.resolve(data.downloadDir.trim());
        const oldUploadsDir = path.resolve(path.join(__dirname, 'uploads'));
        // If config was still pointing to old project ./uploads folder, migrate to user's PC Downloads
        if (resolved === oldUploadsDir) {
          ensureDirSync(DEFAULT_DOWNLOAD_DIR);
          return { downloadDir: DEFAULT_DOWNLOAD_DIR };
        }
        ensureDirSync(resolved);
        return { downloadDir: resolved };
      }
    }
  } catch (err) {
    console.warn('Could not read config.json, using default downloads directory:', err.message);
  }
  ensureDirSync(DEFAULT_DOWNLOAD_DIR);
  return { downloadDir: DEFAULT_DOWNLOAD_DIR };
}

let appConfig = loadConfig();

function getUploadsDir() {
  return appConfig.downloadDir;
}

function setUploadsDir(newPath) {
  const resolved = path.resolve(newPath.trim().replace(/^"|"$/g, ''));
  ensureDirSync(resolved);

  // Check write access by creating and deleting a temporary test file
  const testFile = path.join(resolved, `.airshare_write_test_${Date.now()}`);
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);

  appConfig.downloadDir = resolved;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(appConfig, null, 2), 'utf8');
  return resolved;
}

function resetUploadsDir() {
  ensureDirSync(DEFAULT_DOWNLOAD_DIR);
  appConfig.downloadDir = DEFAULT_DOWNLOAD_DIR;
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(appConfig, null, 2), 'utf8');
  return DEFAULT_DOWNLOAD_DIR;
}

// ==========================================
// SHARED FILES TRACKING
// Only files transferred via AirShare appear in the shared list.
// Existing files in the PC folder are NEVER exposed or deleted!
// ==========================================
function loadSharedFiles() {
  try {
    if (fs.existsSync(SHARED_FILES_MANIFEST)) {
      const data = JSON.parse(fs.readFileSync(SHARED_FILES_MANIFEST, 'utf8'));
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Could not read shared_files.json:', err.message);
  }
  return [];
}

function saveSharedFiles(files) {
  try {
    fs.writeFileSync(SHARED_FILES_MANIFEST, JSON.stringify(files, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving shared_files.json:', err);
  }
}

let sharedFilesList = loadSharedFiles();

function registerSharedFile(filename, size, folder) {
  const targetFolder = path.resolve(folder || getUploadsDir());
  // Remove existing entry if re-uploaded
  sharedFilesList = sharedFilesList.filter(
    (item) => !(item.name === filename && path.resolve(item.folder || targetFolder) === targetFolder)
  );

  const entry = {
    name: filename,
    size: size,
    createdAt: new Date().toISOString(),
    folder: targetFolder
  };

  sharedFilesList.unshift(entry);
  saveSharedFiles(sharedFilesList);
  return entry;
}

function unregisterSharedFile(filename, folder) {
  const targetFolder = path.resolve(folder || getUploadsDir());
  sharedFilesList = sharedFilesList.filter(
    (item) => !(item.name === filename && path.resolve(item.folder || targetFolder) === targetFolder)
  );
  saveSharedFiles(sharedFilesList);
}

function getActiveSharedFiles() {
  const currentDir = path.resolve(getUploadsDir());
  const active = [];
  let modified = false;

  for (const item of sharedFilesList) {
    const itemFolder = path.resolve(item.folder || currentDir);
    // Only return items belonging to current download directory
    if (itemFolder === currentDir) {
      const filePath = path.join(currentDir, item.name);
      if (fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            active.push({
              name: item.name,
              size: stats.size,
              createdAt: item.createdAt || stats.mtime,
              url: `/uploads/${encodeURIComponent(item.name)}`,
              folder: currentDir
            });
            continue;
          }
        } catch (e) {}
      }
      // File no longer exists on disk, mark for pruning
      modified = true;
    }
  }

  if (modified) {
    sharedFilesList = sharedFilesList.filter(item => {
      const itemFolder = path.resolve(item.folder || currentDir);
      if (itemFolder === currentDir) {
        return fs.existsSync(path.join(currentDir, item.name));
      }
      return true;
    });
    saveSharedFiles(sharedFilesList);
  }

  return active;
}

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Dynamically serve ONLY files that were transferred via AirShare
app.use('/uploads', (req, res) => {
  const decodedPath = decodeURI(req.path);
  const safeFilename = path.basename(decodedPath);
  const currentDir = path.resolve(getUploadsDir());

  // Security check: only allow serving files explicitly registered in AirShare!
  const activeFiles = getActiveSharedFiles();
  const isShared = activeFiles.some(f => f.name === safeFilename);

  if (!isShared) {
    return res.status(404).send('File not found or not shared');
  }

  const filePath = path.join(currentDir, safeFilename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(500).send('Error streaming file');
    }
  });
});

// Store clipboard content in memory
let sharedClipboard = '';

// Multer dynamic storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = getUploadsDir();
    ensureDirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const dir = getUploadsDir();
    let name = file.originalname;
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    let finalPath = path.join(dir, name);
    
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      name = `${base} (${counter})${ext}`;
      finalPath = path.join(dir, name);
      counter++;
    }
    cb(null, name);
  }
});

const upload = multer({ storage });

// Find local IPv4 address
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        // Prefer Wi-Fi or Ethernet interfaces
        if (name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('ethernet') || name.toLowerCase().includes('wlan') || name.toLowerCase().includes('lan')) {
          return iface.address;
        }
      }
    }
  }
  // Fallback to first non-internal IPv4 if no Wi-Fi/Ethernet matches explicitly
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIPAddress();
const serverURL = `http://${localIP}:${PORT}`;

// Pre-generate and cache QR code Data URL for instant delivery on connection
let cachedQrDataURL = '';
QRCode.toDataURL(serverURL, { margin: 1, width: 250 }, (err, url) => {
  if (!err) cachedQrDataURL = url;
});

// Serve index.html with pre-injected initial state (0ms roundtrip instant rendering)
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) {
      return res.status(500).send('Error loading AirShare interface');
    }

    const activeFiles = getActiveSharedFiles();
    const sorted = activeFiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const initialData = {
      files: sorted,
      clipboard: sharedClipboard,
      downloadDir: getUploadsDir(),
      defaultDir: DEFAULT_DOWNLOAD_DIR,
      isDefault: getUploadsDir() === DEFAULT_DOWNLOAD_DIR,
      serverURL: serverURL,
      qrDataURL: cachedQrDataURL
    };

    const injection = `<script>window.__INITIAL_DATA__ = ${JSON.stringify(initialData)};</script>`;
    const modifiedHtml = html.replace('</head>', `${injection}\n</head>`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(modifiedHtml);
  });
});

// Serve static assets with fast caching
app.use(express.static(path.join(__dirname, 'public'), {
  index: false // Prevent serving raw index.html without hydration data
}));

// WebSocket connection handling
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  
  const sendInit = (qrUrl) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'init',
        data: {
          clipboard: sharedClipboard,
          serverURL: serverURL,
          qrDataURL: qrUrl || '',
          downloadDir: getUploadsDir(),
          defaultDir: DEFAULT_DOWNLOAD_DIR,
          isDefault: getUploadsDir() === DEFAULT_DOWNLOAD_DIR
        }
      }));
    }
  };

  if (cachedQrDataURL) {
    sendInit(cachedQrDataURL);
  } else {
    QRCode.toDataURL(serverURL, { margin: 1, width: 250 }, (err, qrDataURL) => {
      if (!err) cachedQrDataURL = qrDataURL;
      sendInit(err ? '' : qrDataURL);
    });
  }

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      
      // Broadcast events (upload progress, clipboard updates, new file alerts) to other clients
      if (parsed.type === 'progress' || parsed.type === 'clipboard_update' || parsed.type === 'transfer_start' || parsed.type === 'transfer_complete') {
        if (parsed.type === 'clipboard_update') {
          sharedClipboard = parsed.text;
        }
        
        const msgStr = JSON.stringify(parsed);
        clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(msgStr);
          }
        });
      }
    } catch (e) {
      console.error('Error parsing WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

// Broadcast helper for HTTP endpoints
function broadcast(data) {
  const msgStr = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msgStr);
    }
  });
}

// REST API endpoints

// Get list of shared files (only files transferred via AirShare!)
app.get('/api/files', (req, res) => {
  const activeFiles = getActiveSharedFiles();
  const sorted = activeFiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sorted);
});

// Download all files as a single ZIP archive (only includes shared files!)
app.get('/api/files/download-all', (req, res) => {
  const currentDir = path.resolve(getUploadsDir());
  const activeFiles = getActiveSharedFiles();

  if (activeFiles.length === 0) {
    return res.status(404).send('No files available to download');
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const zipFilename = `AirShare_${dateStr}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

  const archive = createZipArchive({
    zlib: { level: 1 } // Fast compression optimized for local Wi-Fi transfer speeds
  });

  archive.on('error', (archErr) => {
    console.error('Archiver error:', archErr);
    if (!res.headersSent) {
      res.status(500).send('Error creating ZIP archive');
    }
  });

  req.on('close', () => {
    archive.abort();
  });

  archive.pipe(res);

  for (const fileItem of activeFiles) {
    const filePath = path.join(currentDir, fileItem.name);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: fileItem.name });
    }
  }

  archive.finalize();
});

// Upload endpoint
app.post('/api/upload', upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const currentDir = path.resolve(getUploadsDir());
  const uploadedFiles = req.files.map(file => {
    registerSharedFile(file.filename, file.size, currentDir);
    return {
      name: file.filename,
      size: file.size,
      createdAt: new Date(),
      url: `/uploads/${encodeURIComponent(file.filename)}`
    };
  });

  // Broadcast to all clients that new files have been uploaded
  broadcast({
    type: 'files_uploaded',
    files: uploadedFiles
  });

  res.json({ success: true, files: uploadedFiles });
});

// Add local file by path endpoint
app.post('/api/add-by-path', (req, res) => {
  let { filepath } = req.body;
  if (!filepath) {
    return res.status(400).json({ error: 'Filepath is required' });
  }

  // Clean the path (remove leading/trailing quotes)
  filepath = filepath.trim().replace(/^"|"$/g, '');

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ error: 'File not found on local machine' });
  }

  try {
    const stats = fs.statSync(filepath);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Specified path is a directory, not a file' });
    }

    const currentDir = path.resolve(getUploadsDir());
    let originalName = path.basename(filepath);
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    let finalName = originalName;
    let finalDestination = path.join(currentDir, finalName);

    let counter = 1;
    while (fs.existsSync(finalDestination)) {
      finalName = `${base} (${counter})${ext}`;
      finalDestination = path.join(currentDir, finalName);
      counter++;
    }

    // Copy the file to download folder
    fs.copyFileSync(filepath, finalDestination);

    const statsNew = fs.statSync(finalDestination);
    registerSharedFile(finalName, statsNew.size, currentDir);
    const newFile = {
      name: finalName,
      size: statsNew.size,
      createdAt: statsNew.mtime,
      url: `/uploads/${encodeURIComponent(finalName)}`
    };

    // Broadcast update
    broadcast({
      type: 'files_uploaded',
      files: [newFile]
    });

    res.json({ success: true, file: newFile });
  } catch (err) {
    console.error('Error importing file by path:', err);
    res.status(500).json({ error: 'Failed to copy file: ' + err.message });
  }
});

// Delete specific file endpoint
app.delete('/api/files/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const currentDir = path.resolve(getUploadsDir());
  const filePath = path.join(currentDir, filename);

  unregisterSharedFile(filename, currentDir);
  
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete file' });
      }
      broadcast({ type: 'file_deleted', filename });
      res.json({ success: true });
    });
  } else {
    broadcast({ type: 'file_deleted', filename });
    res.json({ success: true });
  }
});

// Clear shared files endpoint (ONLY deletes files that were shared via AirShare!)
app.post('/api/files/clear', (req, res) => {
  const currentDir = path.resolve(getUploadsDir());
  const activeFiles = getActiveSharedFiles();

  let deleteErrors = 0;
  let deletedCount = 0;

  activeFiles.forEach((file) => {
    const filePath = path.join(currentDir, file.name);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    } catch (unlinkErr) {
      console.error(`Failed to delete ${file.name}:`, unlinkErr);
      deleteErrors++;
    }
  });

  // Remove active files from shared registry
  sharedFilesList = sharedFilesList.filter(item => path.resolve(item.folder || currentDir) !== currentDir);
  saveSharedFiles(sharedFilesList);

  // Broadcast updated file list (empty)
  broadcast({
    type: 'files_uploaded',
    files: []
  });

  if (deleteErrors > 0) {
    res.status(500).json({ error: `Deleted ${deletedCount} files, but failed to delete ${deleteErrors} files` });
  } else {
    res.json({ success: true, count: deletedCount });
  }
});

// Configuration API endpoints (PC Download folder settings)
app.get('/api/config', (req, res) => {
  res.json({
    downloadDir: getUploadsDir(),
    defaultDir: DEFAULT_DOWNLOAD_DIR,
    isDefault: getUploadsDir() === DEFAULT_DOWNLOAD_DIR
  });
});

app.post('/api/config', (req, res) => {
  const { downloadDir } = req.body;
  if (!downloadDir || typeof downloadDir !== 'string' || downloadDir.trim() === '') {
    return res.status(400).json({ error: 'Folder path is required' });
  }

  try {
    const updated = setUploadsDir(downloadDir);
    broadcast({
      type: 'config_update',
      downloadDir: updated,
      defaultDir: DEFAULT_DOWNLOAD_DIR,
      isDefault: updated === DEFAULT_DOWNLOAD_DIR
    });
    // Also broadcast files_uploaded so file lists refresh on all connected devices
    broadcast({
      type: 'files_uploaded',
      files: []
    });
    res.json({
      success: true,
      downloadDir: updated,
      isDefault: updated === DEFAULT_DOWNLOAD_DIR
    });
  } catch (err) {
    console.error('Failed to change download folder:', err);
    res.status(400).json({ error: 'Invalid or inaccessible directory: ' + err.message });
  }
});

app.post('/api/config/reset', (req, res) => {
  try {
    const updated = resetUploadsDir();
    broadcast({
      type: 'config_update',
      downloadDir: updated,
      defaultDir: DEFAULT_DOWNLOAD_DIR,
      isDefault: true
    });
    broadcast({
      type: 'files_uploaded',
      files: []
    });
    res.json({
      success: true,
      downloadDir: updated,
      isDefault: true
    });
  } catch (err) {
    console.error('Failed to reset download folder:', err);
    res.status(500).json({ error: 'Failed to reset directory: ' + err.message });
  }
});

// Windows Folder Browser Dialog endpoint
app.post('/api/config/browse-folder', (req, res) => {
  if (os.platform() !== 'win32') {
    return res.status(400).json({ error: 'Folder browser dialog is only supported on Windows' });
  }

  const current = getUploadsDir().replace(/'/g, "''");
  const psScript = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    "$dialog.Description = 'Select AirShare Download / Storage Folder'",
    `$dialog.SelectedPath = '${current}'`,
    '$dialog.ShowNewFolderButton = $true',
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {',
    '  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    '  Write-Output $dialog.SelectedPath',
    '}'
  ].join('\n');

  const b64 = Buffer.from(psScript, 'utf16le').toString('base64');
  exec(`powershell -NoProfile -EncodedCommand ${b64}`, { encoding: 'utf8' }, (err, stdout) => {
    if (err) {
      console.warn('Folder picker dialog closed with notice:', err.message);
      return res.json({ cancelled: true });
    }
    const selected = stdout ? stdout.trim() : '';
    if (!selected) {
      return res.json({ cancelled: true });
    }
    res.json({ success: true, selectedPath: selected });
  });
});

// Clipboard endpoints
app.get('/api/clipboard', (req, res) => {
  res.json({ text: sharedClipboard });
});

app.post('/api/clipboard', (req, res) => {
  const { text } = req.body;
  sharedClipboard = text || '';
  broadcast({
    type: 'clipboard_update',
    text: sharedClipboard
  });
  res.json({ success: true });
});

// Open local folder endpoint (reveals active download folder in Explorer)
app.post('/api/open-folder', (req, res) => {
  const currentDir = getUploadsDir();
  const winPath = currentDir.replace(/\//g, '\\');
  exec(`explorer.exe "${winPath}"`, (err) => {
    if (err) {
      console.warn('explorer.exe exited with code/warning:', err.message);
    }
    res.json({ success: true, path: currentDir });
  });
});

// Handle server errors (e.g. EADDRINUSE)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERROR] Port ${PORT} is already in use by another process.`);
    console.error(`Please close any existing AirShare or node instances using port ${PORT} and try again.\n`);
  } else {
    console.error('\n[ERROR] Server error:', err.message, '\n');
  }
  process.exit(1);
});

// Start Server
server.listen(PORT, () => {
  console.clear();
  console.log('===================================================');
  console.log('       🚀 LOCAL HIGH-SPEED FILE TRANSFER 🚀        ');
  console.log('===================================================');
  console.log(`\nServer Running on PC!`);
  console.log(`Local Access:    http://localhost:${PORT}`);
  console.log(`Network Access:  ${serverURL}`);
  console.log(`Download Folder: ${getUploadsDir()}`);
  console.log('\nScan this QR code with your phone (on same Wi-Fi) to connect:');
  
  QRCode.toString(serverURL, { type: 'terminal', small: true }, (err, qr) => {
    if (err) {
      console.log('Could not generate QR code in terminal:', err.message);
    } else {
      console.log(qr);
    }
    console.log('===================================================');
    console.log('Press Ctrl+C to stop the server.');
  });

  // Automatically open browser on PC
  exec(`start http://localhost:${PORT}`);
});
