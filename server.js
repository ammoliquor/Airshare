const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 3000;
const uploadsDir = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Also serve uploads folder directly so files can be downloaded/streamed
app.use('/uploads', express.static(uploadsDir));

// Store clipboard content in memory
let sharedClipboard = '';

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    let name = file.originalname;
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    let finalPath = path.join(uploadsDir, name);
    
    let counter = 1;
    while (fs.existsSync(finalPath)) {
      name = `${base} (${counter})${ext}`;
      finalPath = path.join(uploadsDir, name);
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

// WebSocket connection handling
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  
  // Generate QR code Data URL for client side offline display
  QRCode.toDataURL(serverURL, { margin: 1, width: 250 }, (err, qrDataURL) => {
    ws.send(JSON.stringify({
      type: 'init',
      data: {
        clipboard: sharedClipboard,
        serverURL: serverURL,
        qrDataURL: err ? '' : qrDataURL
      }
    }));
  });

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      
      // Broadcast events (upload progress, clipboard updates, new file alerts) to other clients
      if (parsed.type === 'progress' || parsed.type === 'clipboard_update' || parsed.type === 'transfer_start' || parsed.type === 'transfer_complete') {
        if (parsed.type === 'clipboard_update') {
          sharedClipboard = parsed.text;
        }
        
        // Broadcast to all clients except sender (or all, depending on event)
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

// Get list of uploaded files
app.get('/api/files', (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read uploads folder' });
    }
    
    const fileList = files
      .filter(file => !file.startsWith('.')) // Skip hidden files
      .map(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          createdAt: stats.mtime,
          url: `/uploads/${encodeURIComponent(file)}`
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // Newest first
      
    res.json(fileList);
  });
});

// Upload endpoint
app.post('/api/upload', upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const uploadedFiles = req.files.map(file => ({
    name: file.filename,
    size: file.size,
    createdAt: new Date(),
    url: `/uploads/${encodeURIComponent(file.filename)}`
  }));

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

    let originalName = path.basename(filepath);
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    let finalName = originalName;
    let finalDestination = path.join(uploadsDir, finalName);

    let counter = 1;
    while (fs.existsSync(finalDestination)) {
      finalName = `${base} (${counter})${ext}`;
      finalDestination = path.join(uploadsDir, finalName);
      counter++;
    }

    // Copy the file
    fs.copyFileSync(filepath, finalDestination);

    const statsNew = fs.statSync(finalDestination);
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

// Delete file endpoint (optional, useful for clean up)
app.delete('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);
  
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete file' });
      }
      broadcast({ type: 'file_deleted', filename });
      res.json({ success: true });
    });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Clear all files endpoint
app.post('/api/files/clear', (req, res) => {
  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read uploads folder' });
    }
    
    let deleteErrors = 0;
    let deletedCount = 0;
    
    files.forEach((file) => {
      if (file.startsWith('.')) return;
      const filePath = path.join(uploadsDir, file);
      try {
        fs.unlinkSync(filePath);
        deletedCount++;
      } catch (unlinkErr) {
        console.error(`Failed to delete ${file}:`, unlinkErr);
        deleteErrors++;
      }
    });
    
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

// Open local folder endpoint (Windows specific)
app.post('/api/open-folder', (req, res) => {
  const winPath = uploadsDir.replace(/\\/g, '/');
  exec(`explorer.exe "${winPath}"`, (err) => {
    if (err) {
      console.warn('explorer.exe exited with code/warning:', err.message);
    }
    res.json({ success: true });
  });
});

// Start Server
server.listen(PORT, () => {
  console.clear();
  console.log('===================================================');
  console.log('       🚀 LOCAL HIGH-SPEED FILE TRANSFER 🚀        ');
  console.log('===================================================');
  console.log(`\nServer Running on PC!`);
  console.log(`Local Access: http://localhost:${PORT}`);
  console.log(`Network Access: ${serverURL}`);
  console.log('\nScan this QR code with your iPhone (on same Wi-Fi) to connect:');
  
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
