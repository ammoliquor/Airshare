// Connection elements
const connectionStatus = document.getElementById('connection-status');
const networkUrlText = document.getElementById('network-url-text');
const desktopPanel = document.getElementById('desktop-panel');
const qrImage = document.getElementById('qr-image');

// Drag and drop / Input elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

// Progress elements
const progressContainer = document.getElementById('progress-container');
const progressFilename = document.getElementById('progress-filename');
const progressSpeed = document.getElementById('progress-speed');
const progressPercent = document.getElementById('progress-percent');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressEta = document.getElementById('progress-eta');
const cancelUploadBtn = document.getElementById('cancel-upload-btn');

// Clipboard elements
const clipboardTextarea = document.getElementById('clipboard-textarea');
const copyClipboardBtn = document.getElementById('copy-clipboard-btn');
const clearClipboardBtn = document.getElementById('clear-clipboard-btn');
const sendClipboardBtn = document.getElementById('send-clipboard-btn');
const clipboardStatus = document.getElementById('clipboard-status');

// Files list elements
const filesList = document.getElementById('files-list');
const filesEmptyState = document.getElementById('files-empty-state');
const filesCount = document.getElementById('files-count');
const refreshFilesBtn = document.getElementById('refresh-files-btn');
const clearFilesBtn = document.getElementById('clear-files-btn');
const openFolderBtn = document.getElementById('open-folder-btn');
const downloadAllBtn = document.getElementById('download-all-btn');

// PC Filepath elements
const pcFilepathInput = document.getElementById('pc-filepath-input');
const pcFilepathBtn = document.getElementById('pc-filepath-btn');
const pcFilepathStatus = document.getElementById('pc-filepath-status');

// PC Download Folder elements
const currentFolderPath = document.getElementById('current-folder-path');
const pcFolderInput = document.getElementById('pc-folder-input');
const pcBrowseFolderBtn = document.getElementById('pc-browse-folder-btn');
const pcSaveFolderBtn = document.getElementById('pc-save-folder-btn');
const pcResetFolderBtn = document.getElementById('pc-reset-folder-btn');
const pcOpenFolderLinkBtn = document.getElementById('pc-open-folder-link-btn');
const pcFolderStatus = document.getElementById('pc-folder-status');

// Global variables
let socket = null;
let currentXHR = null;
let uploadStartTime = 0;
let lastBytesUploaded = 0;
let lastProgressTime = 0;
let speedSmoothingArray = []; // For smoothing out speed fluctuations

// Initialize WebSockets and establish connections
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    connectionStatus.className = 'connection-status connected';
    connectionStatus.querySelector('.status-text').textContent = 'Connected to Network';
  };

  socket.onclose = () => {
    connectionStatus.className = 'connection-status disconnected';
    connectionStatus.querySelector('.status-text').textContent = 'Disconnected. Retrying...';
    // Reconnect after 3 seconds
    setTimeout(initWebSocket, 3000);
  };

  socket.onerror = (error) => {
    console.error('WebSocket Error:', error);
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'init':
          handleInit(message.data);
          break;
        case 'config_update':
          updateFolderUI(message);
          loadFilesList();
          break;
        case 'progress':
          handleRemoteProgress(message);
          break;
        case 'files_uploaded':
          // Another client uploaded files, refresh our list
          loadFilesList();
          // Hide progress if it was a remote progress display
          if (!currentXHR) {
            progressContainer.classList.add('hidden');
          }
          break;
        case 'file_deleted':
          loadFilesList();
          break;
        case 'clipboard_update':
          handleClipboardUpdate(message.text);
          break;
        case 'transfer_start':
          if (!currentXHR) {
            showProgressUI(message.fileName, 0, '0%', 'Waiting...');
          }
          break;
        case 'transfer_complete':
          if (!currentXHR) {
            progressContainer.classList.add('hidden');
            loadFilesList();
          }
          break;
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  };
}

// Handler for initial load state
function handleInit(data) {
  // Update Clipboard
  if (data.clipboard) {
    clipboardTextarea.value = data.clipboard;
  }
  
  // Update direct link UI
  networkUrlText.href = data.serverURL;
  networkUrlText.textContent = data.serverURL;

  // Display QR Code if we are on a desktop (hide desktop panel on mobile)
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    desktopPanel.style.display = 'none';
  } else {
    // Use the server-generated QR Code Data URL (supports 100% offline usage)
    if (data.qrDataURL && qrImage) {
      qrImage.src = data.qrDataURL;
    }
  }

  // Update PC download folder if provided
  if (data.downloadDir) {
    updateFolderUI(data);
  }
}

// Handle clipboard updates from WebSocket
function handleClipboardUpdate(text) {
  clipboardTextarea.value = text;
  
  // Show temporary status
  clipboardStatus.textContent = 'Synced';
  clipboardStatus.classList.add('active');
  
  // Flash effect on textarea
  clipboardTextarea.style.borderColor = 'var(--accent)';
  setTimeout(() => {
    clipboardTextarea.style.borderColor = '';
    clipboardStatus.classList.remove('active');
  }, 2000);
}

// Display progress from other device
function handleRemoteProgress(msg) {
  if (currentXHR) return; // Don't let remote progress override local active uploads
  
  const { fileName, percent, speed, eta } = msg;
  showProgressUI(fileName, percent, percent + '%', speed);
  progressEta.textContent = eta;
  
  if (percent >= 100) {
    setTimeout(() => {
      if (!currentXHR) progressContainer.classList.add('hidden');
    }, 1500);
  }
}

// Format bytes to human readable sizes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Load and render file lists
async function loadFilesList() {
  try {
    const response = await fetch('/api/files');
    const files = await response.json();
    
    // Update files count label
    filesCount.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}`;
    
    if (downloadAllBtn) {
      if (files.length === 0) {
        downloadAllBtn.disabled = true;
        downloadAllBtn.title = 'No files to download';
      } else {
        downloadAllBtn.disabled = false;
        downloadAllBtn.title = `Download all ${files.length} file${files.length !== 1 ? 's' : ''} as a ZIP archive`;
      }
    }
    
    if (files.length === 0) {
      filesList.innerHTML = '';
      filesList.appendChild(filesEmptyState);
      return;
    }
    
    // Clear list but keep empty state hidden
    filesList.innerHTML = '';
    
    files.forEach(file => {
      const fileItem = document.createElement('div');
      
      // Determine file class, label and icon
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      let fileTypeClass = 'other';
      let typeLabel = ext ? ext.replace('.', '').toUpperCase() : 'FILE';
      let iconSvg = '';
      
      const videoExts = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.3gp', '.m4v'];
      const imgExts = ['.jpg', '.jpeg', '.png', '.gif', '.heic', '.webp', '.svg', '.bmp'];
      const audioExts = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'];
      const archiveExts = ['.zip', '.rar', '.7z', '.tar', '.gz'];
      const docExts = ['.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.json', '.md'];
      
      if (videoExts.includes(ext)) {
        fileTypeClass = 'video';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
      } else if (imgExts.includes(ext)) {
        fileTypeClass = 'image';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
      } else if (audioExts.includes(ext)) {
        fileTypeClass = 'audio';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
      } else if (archiveExts.includes(ext)) {
        fileTypeClass = 'archive';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`;
      } else {
        fileTypeClass = 'document';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
      }
      
      fileItem.className = `file-item ${fileTypeClass}`;
      
      const fileDate = new Date(file.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' • ' + new Date(file.createdAt).toLocaleDateString();
      
      fileItem.innerHTML = `
        <div class="file-info">
          <div class="file-type-icon">
            ${iconSvg}
          </div>
          <div class="file-meta">
            <div class="file-title-row">
              <span class="file-title" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
              <span class="file-badge file-badge-${fileTypeClass}">${typeLabel}</span>
            </div>
            <div class="file-details-row">
              <span class="file-size-chip">${formatBytes(file.size)}</span>
              <span class="file-date-text">${fileDate}</span>
            </div>
          </div>
        </div>
        <div class="file-actions">
          <a href="${file.url}" download="${encodeURIComponent(file.name)}" class="btn btn-secondary btn-small">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Download</span>
          </a>
          <button class="btn btn-danger btn-small delete-btn" data-filename="${encodeURIComponent(file.name)}" title="Delete file">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      `;
      
      filesList.appendChild(fileItem);
    });
    
    // Add delete event listeners
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const targetBtn = e.currentTarget;
        const filename = targetBtn.getAttribute('data-filename');
        if (confirm(`Delete ${decodeURIComponent(filename)} permanently?`)) {
          try {
            const delRes = await fetch(`/api/files/${filename}`, { method: 'DELETE' });
            if (delRes.ok) {
              loadFilesList();
            }
          } catch (err) {
            console.error('Failed to delete file', err);
          }
        }
      });
    });
    
  } catch (err) {
    console.error('Error fetching files:', err);
  }
}

// Show progress UI elements
function showProgressUI(fileName, percent, percentStr, speedStr) {
  progressContainer.classList.remove('hidden');
  progressFilename.textContent = fileName;
  progressPercent.textContent = percentStr;
  progressBarFill.style.width = percentStr;
  progressSpeed.textContent = speedStr;
}

// Reset upload variables
function resetUploadState() {
  currentXHR = null;
  progressContainer.classList.add('hidden');
  speedSmoothingArray = [];
  lastBytesUploaded = 0;
}

// Handle multi-file upload utilizing high speed streams
function uploadFiles(files) {
  if (files.length === 0) return;
  
  resetUploadState();
  
  const formData = new FormData();
  let totalSize = 0;
  let fileNames = [];
  
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
    totalSize += files[i].size;
    fileNames.push(files[i].name);
  }
  
  const displayTitle = files.length === 1 ? files[0].name : `${files.length} files (${formatBytes(totalSize)})`;
  
  // Notify other clients via websocket that transfer has started
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'transfer_start',
      fileName: displayTitle
    }));
  }

  showProgressUI(displayTitle, 0, '0%', 'Initializing...');
  progressEta.textContent = 'Calculating remaining time...';

  const xhr = new XMLHttpRequest();
  currentXHR = xhr;
  
  uploadStartTime = Date.now();
  lastBytesUploaded = 0;
  lastProgressTime = uploadStartTime;

  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      const now = Date.now();
      const timeDiff = (now - lastProgressTime) / 1000; // in seconds
      
      const percentComplete = Math.round((event.loaded / event.total) * 100);
      const percentStr = percentComplete + '%';
      
      let speedStr = '0 MB/s';
      let etaStr = 'Calculating...';
      
      if (timeDiff > 0.1 || event.loaded === event.total) {
        const bytesDiff = event.loaded - lastBytesUploaded;
        const currentSpeed = bytesDiff / timeDiff; // bytes per second
        
        // Calculate average smoothed speed to avoid rapid fluctuating values
        speedSmoothingArray.push(currentSpeed);
        if (speedSmoothingArray.length > 8) speedSmoothingArray.shift();
        const avgSpeed = speedSmoothingArray.reduce((a, b) => a + b, 0) / speedSmoothingArray.length;
        
        speedStr = formatBytes(avgSpeed) + '/s';
        
        const remainingBytes = event.total - event.loaded;
        if (avgSpeed > 0) {
          const etaSecs = remainingBytes / avgSpeed;
          if (etaSecs < 1) {
            etaStr = 'Finishing...';
          } else if (etaSecs < 60) {
            etaStr = `About ${Math.round(etaSecs)}s remaining`;
          } else {
            const minutes = Math.floor(etaSecs / 60);
            const seconds = Math.round(etaSecs % 60);
            etaStr = `About ${minutes}m ${seconds}s remaining`;
          }
        }
        
        lastBytesUploaded = event.loaded;
        lastProgressTime = now;
      }
      
      // Update local UI
      showProgressUI(displayTitle, percentComplete, percentStr, speedStr);
      progressEta.textContent = etaStr;
      
      // Broadcast progress via websocket to update PC or other screen
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'progress',
          fileName: displayTitle,
          percent: percentComplete,
          speed: speedStr,
          eta: etaStr
        }));
      }
    }
  });

  xhr.addEventListener('load', () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      progressBarFill.style.width = '100%';
      progressPercent.textContent = '100%';
      progressSpeed.textContent = 'Complete';
      progressEta.textContent = 'Done!';
      
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'transfer_complete',
          fileName: displayTitle
        }));
      }
      
      setTimeout(() => {
        resetUploadState();
        loadFilesList();
      }, 1000);
    } else {
      handleUploadError('Upload failed with status: ' + xhr.status);
    }
  });

  xhr.addEventListener('error', () => {
    handleUploadError('Network error occurred during upload.');
  });

  xhr.addEventListener('abort', () => {
    handleUploadError('Upload cancelled.');
  });

  xhr.open('POST', '/api/upload');
  xhr.send(formData);
}

// Display errors during file transfers
function handleUploadError(errMsg) {
  progressSpeed.textContent = 'Error';
  progressEta.textContent = errMsg;
  progressBarFill.style.backgroundColor = 'var(--danger)';
  
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'progress',
      fileName: 'Upload Failed',
      percent: 100,
      speed: 'Error',
      eta: errMsg
    }));
  }

  setTimeout(() => {
    progressBarFill.style.backgroundColor = ''; // Restore accent color
    resetUploadState();
  }, 4000);
}

// HTML Escaper helper
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Drag & Drop event bindings
['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('dragover');
  }, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');
  }, false);
});

dropZone.addEventListener('drop', (e) => {
  const dt = e.dataTransfer;
  const files = dt.files;
  uploadFiles(files);
});

dropZone.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  uploadFiles(fileInput.files);
});

// Cancel transfer handler
cancelUploadBtn.addEventListener('click', () => {
  if (currentXHR) {
    currentXHR.abort();
  }
});

// Clipboard controls
sendClipboardBtn.addEventListener('click', async () => {
  const text = clipboardTextarea.value;
  try {
    const res = await fetch('/api/clipboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });
    if (res.ok) {
      clipboardStatus.textContent = 'Synced';
      clipboardStatus.classList.add('active');
      setTimeout(() => clipboardStatus.classList.remove('active'), 1500);
    }
  } catch (err) {
    console.error('Error sending clipboard:', err);
  }
});

copyClipboardBtn.addEventListener('click', () => {
  copyToClipboard(clipboardTextarea.value)
    .then(() => {
      const prevText = copyClipboardBtn.textContent;
      copyClipboardBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyClipboardBtn.textContent = prevText;
      }, 1500);
    })
    .catch(err => {
      console.error('Could not copy text to clipboard: ', err);
    });
});

// Robust copy function that works across PC and iOS (Chrome, Safari, etc.)
function copyToClipboard(text) {
  const isIOS = navigator.userAgent.match(/ipad|iphone|ipod/i);
  
  // Use modern Clipboard API on desktop/PC
  if (navigator.clipboard && navigator.clipboard.writeText && !isIOS) {
    return navigator.clipboard.writeText(text);
  }
  
  // Bulletproof copy logic for iOS WebKit browsers which restrict clipboard operations on hidden elements
  return new Promise((resolve, reject) => {
    const activeElement = document.activeElement;
    const scrollY = window.scrollY;
    
    // Save previous text selection ranges
    const selection = window.getSelection();
    const originalRanges = [];
    for (let i = 0; i < selection.rangeCount; i++) {
      originalRanges.push(selection.getRangeAt(i));
    }
    
    // Focus the visible textarea (required by iOS security rules)
    clipboardTextarea.focus();
    
    // Select the content
    if (isIOS) {
      clipboardTextarea.setSelectionRange(0, clipboardTextarea.value.length);
    } else {
      clipboardTextarea.select();
    }
    
    try {
      const successful = document.execCommand('copy');
      
      // Instantly deselect and restore focus to avoid visual highlighting
      clipboardTextarea.blur();
      if (activeElement && typeof activeElement.focus === 'function') {
        activeElement.focus();
      }
      window.scrollTo(0, scrollY);
      
      selection.removeAllRanges();
      originalRanges.forEach(range => selection.addRange(range));
      
      if (successful) {
        resolve();
      } else {
        reject(new Error('copy command failed'));
      }
    } catch (err) {
      clipboardTextarea.blur();
      if (activeElement && typeof activeElement.focus === 'function') {
        activeElement.focus();
      }
      window.scrollTo(0, scrollY);
      selection.removeAllRanges();
      originalRanges.forEach(range => selection.addRange(range));
      reject(err);
    }
  });
}

clearClipboardBtn.addEventListener('click', async () => {
  clipboardTextarea.value = '';
  try {
    const res = await fetch('/api/clipboard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: '' })
    });
    if (res.ok) {
      clipboardStatus.textContent = 'Cleared';
      clipboardStatus.classList.add('active');
      setTimeout(() => clipboardStatus.classList.remove('active'), 1500);
    }
  } catch (err) {
    console.error('Error clearing clipboard:', err);
  }
});

// Refresh button with spinning animation feedback
refreshFilesBtn.addEventListener('click', async () => {
  const svg = refreshFilesBtn.querySelector('svg');
  if (svg) svg.classList.add('spinning');
  
  await loadFilesList();
  
  setTimeout(() => {
    if (svg) svg.classList.remove('spinning');
  }, 600);
});

// Clear all files button
if (clearFilesBtn) {
  clearFilesBtn.addEventListener('click', async () => {
    if (confirm('Delete all shared files permanently from PC?')) {
      try {
        const res = await fetch('/api/files/clear', { method: 'POST' });
        if (res.ok) {
          loadFilesList();
        }
      } catch (err) {
        console.error('Failed to clear shared files:', err);
      }
    }
  });
}

// Open folder button (PC only)
openFolderBtn.addEventListener('click', async () => {
  try {
    await fetch('/api/open-folder', { method: 'POST' });
  } catch (err) {
    console.error('Error opening folder on PC:', err);
  }
});

// Function to resolve PC filepath on the server
async function resolvePCFilepath(filepath) {
  if (!filepath || filepath.trim() === '') return;
  
  showStatus('Resolving file path...', 'info');
  
  try {
    const response = await fetch('/api/add-by-path', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filepath })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      showStatus(`Shared: ${result.file.name}`, 'success');
      if (pcFilepathInput) pcFilepathInput.value = '';
      loadFilesList();
    } else {
      showStatus(result.error || 'Failed to resolve file path', 'error');
    }
  } catch (err) {
    console.error('Error resolving filepath:', err);
    showStatus('Network error resolving file path', 'error');
  }
}

// Display status message in filepath card
function showStatus(msg, type) {
  if (!pcFilepathStatus) return;
  pcFilepathStatus.textContent = msg;
  pcFilepathStatus.className = 'filepath-status ' + type;
  
  if (type !== 'info') {
    setTimeout(() => {
      if (pcFilepathStatus.textContent === msg) {
        pcFilepathStatus.textContent = '';
        pcFilepathStatus.className = 'filepath-status';
      }
    }, 4000);
  }
}

// Global Paste Event Listener
window.addEventListener('paste', async (e) => {
  const target = e.target;
  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
  
  // 1. Handle actual file binaries copied to clipboard
  let files = e.clipboardData.files;
  
  // Bulletproof fallback resolving for mobile browsers (like iOS Safari)
  if (!files || files.length === 0) {
    const items = e.clipboardData.items;
    if (items) {
      const fileList = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) fileList.push(file);
        }
      }
      if (fileList.length > 0) {
        files = fileList;
      }
    }
  }
  
  if (files && files.length > 0) {
    e.preventDefault();
    uploadFiles(files);
    return;
  }
  
  // 2. Handle file path text copied to clipboard (e.g. Shift+Right Click -> "Copy as path")
  const text = e.clipboardData.getData('text');
  if (text && text.trim().length > 0) {
    const cleaned = text.trim().replace(/^"|"$/g, ''); // Strip outer quotes
    
    // Detect Windows and Unix absolute/relative file path formats
    const isWindowsPath = /^[a-zA-Z]:\\/i.test(cleaned) || (cleaned.includes('\\') && !cleaned.includes('\n'));
    const isUnixPath = cleaned.startsWith('/') && !cleaned.includes('\n') && (cleaned.includes('/') && cleaned.split('/').length > 2);
    
    if (isWindowsPath || isUnixPath) {
      // Auto-resolve if not typing in textareas/normal text fields, or if focused on the path input itself
      if (!isInput || target.id === 'pc-filepath-input') {
        e.preventDefault();
        resolvePCFilepath(cleaned);
      }
    }
  }
});

// Event listeners for file path elements (PC only)
if (pcFilepathBtn) {
  pcFilepathBtn.addEventListener('click', () => {
    resolvePCFilepath(pcFilepathInput.value);
  });
}

if (pcFilepathInput) {
  pcFilepathInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      resolvePCFilepath(pcFilepathInput.value);
    }
  });
}

// Download all files as a ZIP archive
if (downloadAllBtn) {
  downloadAllBtn.addEventListener('click', () => {
    if (downloadAllBtn.disabled) return;

    const originalContent = downloadAllBtn.innerHTML;
    downloadAllBtn.disabled = true;
    downloadAllBtn.innerHTML = `
      <svg class="spinning" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
      </svg>
      <span>Downloading...</span>
    `;

    const link = document.createElement('a');
    link.href = '/api/files/download-all';
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      downloadAllBtn.innerHTML = originalContent;
      downloadAllBtn.disabled = false;
    }, 2500);
  });
}

// PC Download Folder Management
async function loadFolderConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    updateFolderUI(data);
  } catch (err) {
    console.error('Failed to load folder configuration:', err);
  }
}

function updateFolderUI(config) {
  if (!config) return;
  if (currentFolderPath && config.downloadDir) {
    currentFolderPath.textContent = config.downloadDir;
    currentFolderPath.title = config.downloadDir;
  }
  if (pcFolderInput && config.downloadDir && !pcFolderInput.value) {
    pcFolderInput.placeholder = config.downloadDir;
  }
  if (pcResetFolderBtn) {
    pcResetFolderBtn.style.display = config.isDefault ? 'none' : 'inline-block';
  }
}

function showFolderStatus(msg, type) {
  if (!pcFolderStatus) return;
  pcFolderStatus.textContent = msg;
  pcFolderStatus.className = 'filepath-status ' + type;
  
  if (type !== 'info') {
    setTimeout(() => {
      if (pcFolderStatus.textContent === msg) {
        pcFolderStatus.textContent = '';
        pcFolderStatus.className = 'filepath-status';
      }
    }, 4000);
  }
}

async function saveDownloadFolder(newPath) {
  if (!newPath || !newPath.trim()) {
    showFolderStatus('Please enter a folder path', 'error');
    return;
  }

  showFolderStatus('Updating download folder...', 'info');

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadDir: newPath.trim() })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      updateFolderUI(data);
      if (pcFolderInput) pcFolderInput.value = '';
      showFolderStatus('Download folder updated!', 'success');
      loadFilesList();
    } else {
      showFolderStatus(data.error || 'Failed to update folder', 'error');
    }
  } catch (err) {
    console.error('Error updating folder:', err);
    showFolderStatus('Network error updating folder', 'error');
  }
}

async function resetDownloadFolder() {
  showFolderStatus('Resetting to default folder...', 'info');

  try {
    const res = await fetch('/api/config/reset', { method: 'POST' });
    const data = await res.json();

    if (res.ok && data.success) {
      updateFolderUI(data);
      if (pcFolderInput) pcFolderInput.value = '';
      showFolderStatus('Reset to Downloads folder', 'success');
      loadFilesList();
    } else {
      showFolderStatus(data.error || 'Failed to reset folder', 'error');
    }
  } catch (err) {
    console.error('Error resetting folder:', err);
    showFolderStatus('Network error resetting folder', 'error');
  }
}

async function browsePCFolder() {
  if (pcBrowseFolderBtn) {
    pcBrowseFolderBtn.disabled = true;
    pcBrowseFolderBtn.textContent = 'Browsing...';
  }

  showFolderStatus('Select folder in the Windows dialog on your PC...', 'info');

  try {
    const res = await fetch('/api/config/browse-folder', { method: 'POST' });
    const data = await res.json();

    if (data.success && data.selectedPath) {
      await saveDownloadFolder(data.selectedPath);
    } else if (data.cancelled) {
      showFolderStatus('Folder selection cancelled', 'info');
      setTimeout(() => {
        if (pcFolderStatus && pcFolderStatus.textContent.includes('cancelled')) {
          pcFolderStatus.textContent = '';
          pcFolderStatus.className = 'filepath-status';
        }
      }, 2000);
    } else if (data.error) {
      showFolderStatus(data.error, 'error');
    }
  } catch (err) {
    console.error('Error opening folder picker:', err);
    showFolderStatus('Failed to open folder picker', 'error');
  } finally {
    if (pcBrowseFolderBtn) {
      pcBrowseFolderBtn.disabled = false;
      pcBrowseFolderBtn.textContent = 'Browse...';
    }
  }
}

// Event listeners for folder controls
if (pcSaveFolderBtn && pcFolderInput) {
  pcSaveFolderBtn.addEventListener('click', () => {
    saveDownloadFolder(pcFolderInput.value);
  });
  pcFolderInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveDownloadFolder(pcFolderInput.value);
    }
  });
}

if (pcBrowseFolderBtn) {
  pcBrowseFolderBtn.addEventListener('click', browsePCFolder);
}

if (pcResetFolderBtn) {
  pcResetFolderBtn.addEventListener('click', resetDownloadFolder);
}

if (pcOpenFolderLinkBtn) {
  pcOpenFolderLinkBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/open-folder', { method: 'POST' });
    } catch (err) {
      console.error('Error opening folder on PC:', err);
    }
  });
}

// Main startup
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  loadFilesList();
  loadFolderConfig();
});
