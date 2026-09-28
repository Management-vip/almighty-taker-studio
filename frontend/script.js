// ===== CONFIGURATION — UPDATE THESE WITH YOUR RENDER URLS =====
const NODE_API = 'https://almighty-taker-studio-api.onrender.com';   // Your Node.js backend
const PYTHON_WS = 'https://almighty-taker-py-server.onrender.com'; // Your Python processing server

// ===== STATE =====
let token = localStorage.getItem('token');
let currentUser = null;
let isLoginMode = false;
let localStream = null;          // Camera stream
let socket = null;              // Socket.IO client to Python server
let isProcessing = false;       // True only when Python confirms processing active
let processingActive = false;   // Same as above
let streamSessionId = null;     // ID for current stream session

// ===== DOM REFS =====
const heroSection = document.getElementById('heroSection');
const featuresSection = document.getElementById('featuresSection');
const authSection = document.getElementById('authSection');
const dashboardSection = document.getElementById('dashboardSection');
const adminSection = document.getElementById('adminSection');
const navDashboard = document.getElementById('navDashboard');
const navAdmin = document.getElementById('navAdmin');
const navAuthBtn = document.getElementById('navAuthBtn');
const navHome = document.getElementById('navHome');
const authTitle = document.getElementById('authTitle');
const authBtn = document.getElementById('authBtn');
const toggleLink = document.getElementById('toggleLink');
const toggleText = document.getElementById('toggleText');
const authAlert = document.getElementById('authAlert');
const dashAlert = document.getElementById('dashAlert');
const adminAlert = document.getElementById('adminAlert');
const emailInput = document.getElementById('email');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const usernameGroup = document.getElementById('usernameGroup');
const balanceDisplay = document.getElementById('balanceDisplay');
const depositBtn = document.getElementById('depositBtn');
const goLiveBtn = document.getElementById('goLiveBtn');
const depositModal = document.getElementById('depositModal');
const depositAmount = document.getElementById('depositAmount');
const requestDepositBtn = document.getElementById('requestDepositBtn');
const closeDepositModal = document.getElementById('closeDepositModal');
const liveModal = document.getElementById('liveModal');
const stopLiveBtn = document.getElementById('stopLiveBtn');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const uploadPreview = document.getElementById('uploadPreview');
const transactionList = document.getElementById('transactionList');
const pendingList = document.getElementById('pendingList');
const userList = document.getElementById('userList');
const livePreview = document.getElementById('livePreview');
const liveContent = document.getElementById('liveContent');

// ===== UTILITY =====
function showAlert(el, msg, type = 'error') {
  el.textContent = msg;
  el.className = `alert alert-${type}`;
  el.style.display = 'block';
}
function hideAlert(el) { el.style.display = 'none'; }

// ===== NAVIGATION =====
function showSection(section) {
  [heroSection, featuresSection, authSection, dashboardSection, adminSection].forEach(s => {
    if (s) {
      if (s === featuresSection) {
        s.style.display = 'none';
      } else {
        s.classList.remove('active');
      }
    }
  });
  if (section) {
    if (section === featuresSection) {
      section.style.display = 'block';
    } else {
      section.classList.add('active');
    }
  }
}

navHome.addEventListener('click', (e) => {
  e.preventDefault();
  showSection(heroSection);
  featuresSection.style.display = 'block';
});

navDashboard.addEventListener('click', (e) => {
  e.preventDefault();
  showSection(dashboardSection);
});

navAdmin.addEventListener('click', (e) => {
  e.preventDefault();
  showSection(adminSection);
  loadPending();
  loadUsers();
});

navAuthBtn.addEventListener('click', () => {
  showSection(authSection);
});

// ===== TOGGLE AUTH MODE =====
toggleLink.addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  if (isLoginMode) {
    authTitle.textContent = '🔑 Log In';
    authBtn.textContent = '🔑 Log In';
    toggleText.textContent = "Don't have an account?";
    toggleLink.textContent = 'Create one';
    usernameGroup.style.display = 'none';
  } else {
    authTitle.textContent = '🔐 Create Your Account';
    authBtn.textContent = '🚀 Create Account';
    toggleText.textContent = 'Already have an account?';
    toggleLink.textContent = 'Log in';
    usernameGroup.style.display = 'block';
  }
  hideAlert(authAlert);
});

// ===== AUTH — with token expiry handling =====
authBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const username = usernameInput.value.trim();

  if (!email || !password) {
    showAlert(authAlert, 'Please fill in all required fields.');
    return;
  }
  if (!isLoginMode && !username) {
    showAlert(authAlert, 'Username is required for registration.');
    return;
  }

  const endpoint = isLoginMode ? '/api/login' : '/api/register';
  const body = isLoginMode ? { email, password } : { email, username, password };

  try {
    const res = await fetch(`${NODE_API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) {
      showAlert(authAlert, data.error || 'Authentication failed.');
      return;
    }
    token = data.token;
    localStorage.setItem('token', token);
    currentUser = data.user;
    onAuthSuccess();
  } catch (err) {
    showAlert(authAlert, 'Network error. Is the Node backend running?');
  }
});

function onAuthSuccess() {
  hideAlert(authAlert);
  showSection(dashboardSection);
  navDashboard.style.display = 'inline';
  navAuthBtn.textContent = 'Dashboard';
  if (currentUser && currentUser.is_admin) {
    navAdmin.style.display = 'inline';
  }
  loadBalance();
  loadTransactions();
}

// ===== TOKEN EXPIRY HANDLER =====
async function authenticatedFetch(url, options = {}) {
  // Attach token
  if (!options.headers) options.headers = {};
  options.headers['Authorization'] = `Bearer ${token}`;
  
  try {
    const res = await fetch(url, options);
    
    // If 401, token expired
    if (res.status === 401) {
      localStorage.removeItem('token');
      token = null;
      currentUser = null;
      showSection(authSection);
      navDashboard.style.display = 'none';
      navAdmin.style.display = 'none';
      navAuthBtn.textContent = 'Get Started';
      showAlert(authAlert, 'Session expired. Please log in again.', 'error');
      return null;
    }
    
    return res;
  } catch (err) {
    throw err;
  }
}

// ===== BALANCE =====
async function loadBalance() {
  try {
    const res = await authenticatedFetch(`${NODE_API}/api/balance`);
    if (!res) return;
    const data = await res.json();
    balanceDisplay.textContent = data.coins || 0;
  } catch (e) {
    console.error('Balance load failed');
  }
}

// ===== TRANSACTIONS =====
async function loadTransactions() {
  try {
    const res = await authenticatedFetch(`${NODE_API}/api/transactions`);
    if (!res) return;
    const data = await res.json();
    if (data.length === 0) {
      transactionList.innerHTML = '<p style="color:var(--text-muted); font-size:.9rem;">No transactions yet.</p>';
      return;
    }
    transactionList.innerHTML = data.map(tx => `
      <div style="display:flex; justify-content:space-between; padding:.5rem 0; border-bottom:1px solid var(--border);">
        <span>${tx.amount} coins</span>
        <span class="status-${tx.status}">${tx.status}</span>
        <span style="color:var(--text-muted); font-size:.8rem;">${new Date(tx.created_at).toLocaleDateString()}</span>
      </div>
    `).join('');
  } catch (e) {
    transactionList.innerHTML = '<p style="color:var(--text-muted); font-size:.9rem;">Failed to load.</p>';
  }
}

// ===== DEPOSIT — with error handling =====
depositBtn.addEventListener('click', () => {
  depositModal.classList.add('active');
});

closeDepositModal.addEventListener('click', () => {
  depositModal.classList.remove('active');
});

requestDepositBtn.addEventListener('click', async () => {
  const amount = parseInt(depositAmount.value);
  if (!amount || amount < 10) {
    alert('Minimum 10 coins.');
    return;
  }
  try {
    const res = await authenticatedFetch(`${NODE_API}/api/deposit/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });
    if (!res) return;
    const data = await res.json();
    if (res.ok) {
      alert(`✅ Deposit requested!\n\nTransfer ${amount} coins to:\nBank: 1234567890\nName: Almighty Taker\n\nAdmin will confirm shortly.`);
      depositModal.classList.remove('active');
      loadTransactions();
    } else {
      alert(data.error || 'Deposit request failed.');
    }
  } catch (e) {
    alert('Network error. Is the Node backend running?');
  }
});

// ===== UPLOAD — with error handling =====
uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // Preview
  const reader = new FileReader();
  reader.onload = (ev) => {
    uploadPreview.src = ev.target.result;
    uploadZone.classList.add('has-file');
  };
  reader.readAsDataURL(file);

  // Upload to Node backend
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await authenticatedFetch(`${NODE_API}/api/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res) return;
    const data = await res.json();
    if (res.ok) {
      showAlert(dashAlert, '✅ File uploaded successfully!', 'success');
    } else {
      showAlert(dashAlert, data.error || 'Upload failed.');
    }
  } catch (e) {
    showAlert(dashAlert, 'Upload network error. Is the Node backend running?');
  }
});

// ===== GO LIVE — REAL CAMERA + SOCKET.IO TO PYTHON =====
goLiveBtn.addEventListener('click', async () => {
  // 1. Check coin balance via Node backend
  try {
    const res = await authenticatedFetch(`${NODE_API}/api/stream/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      showAlert(dashAlert, data.error || 'Cannot start stream.');
      return;
    }
    streamSessionId = data.session_id || 'live-' + Date.now();
  } catch (e) {
    showAlert(dashAlert, 'Network error checking balance. Is the Node backend running?');
    return;
  }

  // 2. Request camera access
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      audio: false
    });
  } catch (err) {
    showAlert(dashAlert, `Camera access denied: ${err.message}. Allow camera permissions.`);
    // Refund coins
    await authenticatedFetch(`${NODE_API}/api/stream/fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => {});
    return;
  }

  // 3. Connect to Python processing server via Socket.IO
  liveModal.classList.add('active');
  livePreview.innerHTML = `
    <div style="position:relative;">
      <video id="localVideo" autoplay playsinline muted style="width:100%; max-height:400px; border-radius:8px;"></video>
      <div id="processingStatus" style="position:absolute; top:10px; left:10px; background:rgba(0,0,0,.6); color:#ffa502; padding:4px 12px; border-radius:20px; font-size:.75rem;">
        ⏳ Connecting to processing server...
      </div>
    </div>
  `;
  
  const video = document.getElementById('localVideo');
  video.srcObject = localStream;
  
  // 4. Initialize Socket.IO connection to Python server
  connectProcessingSocket();
  
  loadBalance();
});

// ===== SOCKET.IO CONNECTION TO PYTHON PROCESSING SERVER =====
function connectProcessingSocket() {
  // Close any existing connection
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  
  // Connect using Socket.IO client
  socket = io(PYTHON_WS, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000
  });
  
  socket.on('connect', () => {
    console.log('✅ Connected to processing server');
    updateProcessingStatus('🟢 Processing server connected', '#00cec9');
    
    // Register this session
    socket.emit('register_session', {
      session_id: streamSessionId,
      token: token
    });
    
    // Start sending frames from camera
    startSendingFrames();
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ Processing server connection error:', error.message);
    updateProcessingStatus('❌ Processing server unavailable — camera only', '#ff6b6b');
    // Camera still works, just no processing
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from processing server:', reason);
    updateProcessingStatus('⏳ Reconnecting to processing server...', '#ffa502');
  });
  
  socket.on('processing_active', (data) => {
    isProcessing = true;
    processingActive = true;
    updateProcessingStatus('🔴 Processing active — deepfake running', '#00cec9');
  });
  
  socket.on('processing_inactive', (data) => {
    isProcessing = false;
    processingActive = false;
    updateProcessingStatus('⚠️ Processing paused', '#ffa502');
  });
  
  socket.on('processed_frame', (data) => {
    // Display processed frame
    let processedImg = document.getElementById('processedFrame');
    if (!processedImg) {
      processedImg = document.createElement('img');
      processedImg.id = 'processedFrame';
      processedImg.style.width = '100%';
      processedImg.style.maxHeight = '400px';
      processedImg.style.borderRadius = '8px';
      processedImg.style.display = 'none';
      livePreview.appendChild(processedImg);
    }
    
    if (data && data.frame) {
      processedImg.src = 'data:image/jpeg;base64,' + data.frame;
      processedImg.style.display = 'block';
      // Hide raw video when processed frame available
      const rawVideo = document.getElementById('localVideo');
      if (rawVideo) rawVideo.style.display = 'none';
    }
  });
  
  socket.on('error', (data) => {
    console.error('Processing server error:', data.message);
    updateProcessingStatus('❌ Processing error: ' + (data.message || 'unknown'), '#ff6b6b');
  });
}

// ===== SEND CAMERA FRAMES TO PYTHON SERVER =====
let frameInterval = null;

function startSendingFrames() {
  if (frameInterval) {
    clearInterval(frameInterval);
    frameInterval = null;
  }
  
  const video = document.getElementById('localVideo');
  if (!video) return;
  
  // Create a canvas to capture frames
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 640;
  canvas.height = 480;
  
  frameInterval = setInterval(() => {
    if (!socket || !socket.connected) return;
    if (!localStream || !localStream.active) {
      stopSendingFrames();
      return;
    }
    
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to blob and send
    canvas.toBlob((blob) => {
      if (blob && socket && socket.connected) {
        // Send as binary via Socket.IO
        socket.emit('video_frame', blob);
      }
    }, 'image/jpeg', 0.8);
  }, 100); // ~10 FPS to reduce bandwidth
}

function stopSendingFrames() {
  if (frameInterval) {
    clearInterval(frameInterval);
    frameInterval = null;
  }
}

function updateProcessingStatus(text, color) {
  const status = document.getElementById('processingStatus');
  if (status) {
    status.textContent = text;
    status.style.color = color || '#ffa502';
  }
}

// ===== STOP STREAM — SAFE DISCONNECT =====
stopLiveBtn.addEventListener('click', () => {
  // 1. Stop sending frames
  stopSendingFrames();
  
  // 2. Notify Python server
  if (socket && socket.connected) {
    socket.emit('stop_processing', { session_id: streamSessionId });
    socket.disconnect();
    socket = null;
  }
  
  // 3. Stop camera safely
  if (localStream) {
    localStream.getTracks().forEach(track => {
      track.stop();
    });
    localStream = null;
  }
  
  // 4. Notify Node backend
  authenticatedFetch(`${NODE_API}/api/stream/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: streamSessionId })
  }).catch(() => {}).finally(() => {
    streamSessionId = null;
    isProcessing = false;
    processingActive = false;
    liveModal.classList.remove('active');
    loadBalance();
  });
});

// ===== ADMIN =====
async function loadPending() {
  try {
    const res = await authenticatedFetch(`${NODE_API}/api/admin/pending`);
    if (!res) return;
    const data = await res.json();
    if (!data || data.length === 0) {
      pendingList.innerHTML = '<p style="color:var(--text-muted); font-size:.9rem;">No pending deposits.</p>';
      return;
    }
    pendingList.innerHTML = data.map(tx => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:.75rem 0; border-bottom:1px solid var(--border);">
        <div>
          <strong>${tx.users?.username || 'Unknown'}</strong> — ${tx.amount} coins
          <p style="font-size:.8rem; color:var(--text-muted);">${new Date(tx.created_at).toLocaleString()}</p>
        </div>
        <button class="btn btn-accent btn-sm" onclick="confirmTx('${tx.id}')">✅ Confirm</button>
      </div>
    `).join('');
  } catch (e) {
    pendingList.innerHTML = '<p style="color:var(--text-muted);">Failed to load.</p>';
  }
}

async function loadUsers() {
  try {
    const res = await authenticatedFetch(`${NODE_API}/api/admin/users`);
    if (!res) return;
    const data = await res.json();
    if (!data || data.length === 0) {
      userList.innerHTML = '<p style="color:var(--text-muted);">No users.</p>';
      return;
    }
    userList.innerHTML = `<table class="admin-table">
      <thead><tr><th>User</th><th>Email</th><th>Coins</th><th>Joined</th></tr></thead>
      <tbody>
        ${data.map(u => `<tr><td>${u.username}</td><td>${u.email}</td><td>${u.coins}</td><td>${new Date(u.created_at).toLocaleDateString()}</td></tr>`).join('')}
      </tbody>
    </table>`;
  } catch (e) {
    userList.innerHTML = '<p style="color:var(--text-muted);">Failed to load.</p>';
  }
}

async function confirmTx(id) {
  try {
    const res = await authenticatedFetch(`${NODE_API}/api/admin/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: id })
    });
    if (!res) return;
    const data = await res.json();
    if (res.ok) {
      loadPending();
      showAlert(adminAlert, '✅ Deposit confirmed!', 'success');
    } else {
      showAlert(adminAlert, data.error || 'Confirmation failed.', 'error');
    }
  } catch (e) {
    showAlert(adminAlert, 'Network error.', 'error');
  }
}

// ===== AUTO LOGIN CHECK =====
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiry = payload.exp * 1000;
    if (Date.now() > expiry) {
      // Token expired
      localStorage.removeItem('token');
      token = null;
    } else {
      currentUser = { id: payload.id, email: payload.email, is_admin: payload.is_admin };
      onAuthSuccess();
    }
  } catch (e) {
    localStorage.removeItem('token');
    token = null;
  }
}
