// ===== API URLs =====
const NODE_API = 'https://almighty-taker-studio-api.onrender.com';
const PYTHON_WS = 'https://almighty-taker-py-server.onrender.com';

// ===== STATE =====
let token = localStorage.getItem('token');
let currentUser = null;
let isLoginMode = false;
let localStream = null;
let socket = null;
let streamSessionId = null;
let isProcessing = false;
let frameInterval = null;

// ===== DOM REFS =====
const $ = (id) => document.getElementById(id);
const heroSection = $('heroSection');
const authSection = $('authSection');
const dashboardSection = $('dashboardSection');
const adminSection = $('adminSection');
const navDashboard = $('navDashboard');
const navAdmin = $('navAdmin');
const navAuthBtn = $('navAuthBtn');
const navHome = $('navHome');
const authTitle = $('authTitle');
const authBtn = $('authBtn');
const toggleLink = $('toggleLink');
const toggleText = $('toggleText');
const authAlert = $('authAlert');
const dashAlert = $('dashAlert');
const adminAlert = $('adminAlert');
const emailInput = $('email');
const usernameInput = $('username');
const passwordInput = $('password');
const usernameGroup = $('usernameGroup');
const balanceDisplay = $('balanceDisplay');
const depositBtn = $('depositBtn');
const goLiveBtn = $('goLiveBtn');
const depositModal = $('depositModal');
const depositAmount = $('depositAmount');
const requestDepositBtn = $('requestDepositBtn');
const closeDepositModal = $('closeDepositModal');
const liveModal = $('liveModal');
const stopLiveBtn = $('stopLiveBtn');
const uploadZone = $('uploadZone');
const fileInput = $('fileInput');
const uploadPreview = $('uploadPreview');
const transactionList = $('transactionList');
const pendingList = $('pendingList');
const userList = $('userList');
const livePreview = $('livePreview');

// ===== UTILITY =====
function showAlert(el, msg, type = 'error') {
  el.textContent = msg;
  el.className = `alert alert-${type}`;
  el.style.display = 'block';
}
function hideAlert(el) { el.style.display = 'none'; }

// ===== SECTION CONTROL =====
function showSection(section) {
  [heroSection, authSection, dashboardSection, adminSection].forEach(s => s.classList.remove('active'));
  if (section) section.classList.add('active');
}

// ===== NAV =====
navHome.onclick = e => { e.preventDefault(); showSection(heroSection); };
navDashboard.onclick = e => { e.preventDefault(); showSection(dashboardSection); };
navAdmin.onclick = e => { e.preventDefault(); showSection(adminSection); loadPending(); loadUsers(); };
navAuthBtn.onclick = () => showSection(authSection);

// ===== HERO GET STARTED =====
$('heroGetStarted').onclick = e => {
  e.preventDefault();
  showSection(authSection);
};

// ===== TOGGLE LOGIN / REGISTER =====
toggleLink.onclick = () => {
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
};

// ===== AUTH =====
authBtn.onclick = async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const username = usernameInput.value.trim();
  if (!email || !password) return showAlert(authAlert, 'Fill all required fields.');
  if (!isLoginMode && !username) return showAlert(authAlert, 'Username required.');

  const endpoint = isLoginMode ? '/api/login' : '/api/register';
  const body = isLoginMode ? { email, password } : { email, username, password };

  try {
    const res = await fetch(`${NODE_API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) return showAlert(authAlert, data.error || 'Auth failed.');
    token = data.token;
    localStorage.setItem('token', token);
    currentUser = data.user;
    onAuthSuccess();
  } catch {
    showAlert(authAlert, 'Network error. Is backend running?');
  }
};

function onAuthSuccess() {
  hideAlert(authAlert);
  showSection(dashboardSection);
  navDashboard.style.display = 'inline';
  navAuthBtn.textContent = 'Dashboard';
  if (currentUser?.is_admin) navAdmin.style.display = 'inline';
  loadBalance();
  loadTransactions();
}

// ===== TOKEN-AWARE FETCH =====
async function authFetch(url, options = {}) {
  if (!options.headers) options.headers = {};
  options.headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, options);
  if (res.status === 401) {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    showSection(authSection);
    navDashboard.style.display = 'none';
    navAdmin.style.display = 'none';
    navAuthBtn.textContent = 'Get Started';
    showAlert(authAlert, 'Session expired. Please log in again.');
    return null;
  }
  return res;
}

// ===== BALANCE =====
async function loadBalance() {
  try {
    const res = await authFetch(`${NODE_API}/api/balance`);
    if (!res) return;
    const data = await res.json();
    balanceDisplay.textContent = data.coins || 0;
  } catch {
    console.error('balance fail');
  }
}

// ===== TRANSACTIONS =====
async function loadTransactions() {
  try {
    const res = await authFetch(`${NODE_API}/api/transactions`);
    if (!res) return;
    const data = await res.json();
    if (!data || data.length === 0) {
      transactionList.innerHTML =
        '<p style="color:var(--text-muted);font-size:.85rem;">No transactions yet.</p>';
      return;
    }
    transactionList.innerHTML = data
      .map(
        tx => `<div><span>${tx.amount} coins</span> <span class="status-${tx.status}">${
          tx.status
        }</span> <span style="color:var(--text-muted);font-size:.75rem;">${new Date(
          tx.created_at
        ).toLocaleDateString()}</span></div>`
      )
      .join('');
  } catch {
    transactionList.innerHTML =
      '<p style="color:var(--text-muted);">Failed to load.</p>';
  }
}

// ===== DEPOSIT =====
depositBtn.onclick = () => depositModal.classList.add('active');
closeDepositModal.onclick = () => depositModal.classList.remove('active');
requestDepositBtn.onclick = async () => {
  const amount = parseInt(depositAmount.value);
  if (!amount || amount < 10) return alert('Min 10 coins.');
  try {
    const res = await authFetch(`${NODE_API}/api/deposit/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });
    if (!res) return;
    const data = await res.json();
    if (res.ok) {
      alert(
        '✅ Deposit requested!\n\nTransfer to:\nBank: 1234567890\nName: Almighty Taker'
      );
      depositModal.classList.remove('active');
      loadTransactions();
    } else alert(data.error);
  } catch {
    alert('Network error.');
  }
};

// ===== UPLOAD =====
uploadZone.onclick = () => fileInput.click();
fileInput.onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    uploadPreview.src = ev.target.result;
    uploadPreview.style.display = 'block';
  };
  reader.readAsDataURL(file);

  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await authFetch(`${NODE_API}/api/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res) return;
    const data = await res.json();
    if (res.ok) showAlert(dashAlert, '✅ File uploaded!', 'success');
    else showAlert(dashAlert, data.error || 'Upload failed.');
  } catch {
    showAlert(dashAlert, 'Upload error.');
  }
};

// ===== GO LIVE =====
goLiveBtn.onclick = async () => {
  try {
    const res = await authFetch(`${NODE_API}/api/stream/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) return showAlert(dashAlert, data.error);
    streamSessionId = data.session_id;
  } catch {
    return showAlert(dashAlert, 'Network error.');
  }

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false
    });
  } catch (err) {
    showAlert(dashAlert, `Camera error: ${err.message}`);
    authFetch(`${NODE_API}/api/stream/fail`, {
      method: 'POST'
    }).catch(() => {});
    return;
  }

  liveModal.classList.add('active');
  livePreview.innerHTML = `<div style="position:relative;"><video id="localVideo" autoplay playsinline muted style="width:100%;border-radius:16px;max-height:360px;object-fit:cover;"></video><div id="processingStatus" style="position:absolute;top:12px;left:12px;background:rgba(0,0,0,.5);padding:4px 12px;border-radius:20px;font-size:.75rem;">⏳ Connecting...</div></div>`;
  const video = document.getElementById('localVideo');
  video.srcObject = localStream;
  connectProcessingSocket();
  loadBalance();
};

// ===== SOCKET.IO =====
function connectProcessingSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socket = io(PYTHON_WS, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    updateStatus('🟢 Processing server connected', '#00cec9');
    socket.emit('register_session', { session_id: streamSessionId, token });
    startSendingFrames();
  });

  socket.on('connect_error', () =>
    updateStatus('❌ Processing unavailable — camera only', '#ef4444')
  );

  socket.on('processing_active', () => {
    isProcessing = true;
    updateStatus('🔴 Deepfake active', '#00cec9');
  });

  socket.on('processing_inactive', () => {
    isProcessing = false;
    updateStatus('⚠️ Paused', '#f59e0b');
  });

  socket.on('processed_frame', data => {
    let img = document.getElementById('processedFrame');
    if (!img) {
      img = document.createElement('img');
      img.id = 'processedFrame';
      Object.assign(img.style, {
        width: '100%',
        borderRadius: '16px',
        maxHeight: '360px',
        objectFit: 'cover',
        display: 'none'
      });
      livePreview.appendChild(img);
    }
    if (data && data.frame) {
      img.src = 'data:image/jpeg;base64,' + data.frame;
      img.style.display = 'block';
      const rawVid = document.getElementById('localVideo');
      if (rawVid) rawVid.style.display = 'none';
    }
  });
}

function startSendingFrames() {
  clearInterval(frameInterval);
  const video = document.getElementById('localVideo');
  if (!video) return;
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  frameInterval = setInterval(() => {
    if (!socket || !socket.connected) return;
    if (!localStream || !localStream.active) {
      stopSendingFrames();
      return;
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob && socket && socket.connected) socket.emit('video_frame', blob);
    }, 'image/jpeg', 0.8);
  }, 100);
}

function stopSendingFrames() {
  clearInterval(frameInterval);
}

function updateStatus(text, color) {
  const el = document.getElementById('processingStatus');
  if (el) {
    el.textContent = text;
    el.style.color = color;
  }
}

// ===== STOP STREAM =====
stopLiveBtn.onclick = () => {
  stopSendingFrames();
  if (socket && socket.connected) {
    socket.emit('stop_processing', { session_id: streamSessionId });
    socket.disconnect();
    socket = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  authFetch(`${NODE_API}/api/stream/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: streamSessionId })
  })
    .catch(() => {})
    .finally(() => {
      streamSessionId = null;
      isProcessing = false;
      liveModal.classList.remove('active');
      loadBalance();
    });
};

// ===== ADMIN =====
async function loadPending() {
  try {
    const res = await authFetch(`${NODE_API}/api/admin/pending`);
    if (!res) return;
    const data = await res.json();
    if (!data || data.length === 0) {
      pendingList.innerHTML =
        '<p style="color:var(--text-muted);font-size:.85rem;">No pending deposits.</p>';
      return;
    }
    pendingList.innerHTML = data
      .map(
        tx => `<div style="display:flex;justify-content:space-between;align-items:center;padding:.75rem 0;border-bottom:1px solid var(--border);">
          <div>
            <strong>${tx.users?.username || 'Unknown'}</strong> — ${
          tx.amount
        } coins
            <p style="font-size:.8rem;color:var(--text-muted);">${new Date(
              tx.created_at
            ).toLocaleString()}</p>
          </div>
          <button class="btn btn-accent btn-sm" onclick="confirmTxHelper('${
            tx.id
          }')">✅ Confirm</button>
        </div>`
      )
      .join('');
  } catch {
    pendingList.innerHTML =
      '<p style="color:var(--text-muted);">Failed.</p>';
  }
}

async function loadUsers() {
  try {
    const res = await authFetch(`${NODE_API}/api/admin/users`);
    if (!res) return;
    const data = await res.json();
    if (!data || data.length === 0) {
      userList.innerHTML = '<p style="color:var(--text-muted);">No users.</p>';
      return;
    }
    userList.innerHTML = `<table class="admin-table">
      <thead><tr><th>User</th><th>Email</th><th>Coins</th><th>Joined</th></tr></thead>
      <tbody>
        ${data
          .map(
            u =>
              `<tr><td>${u.username}</td><td>${u.email}</td><td>${u.coins}</td><td>${new Date(
                u.created_at
              ).toLocaleDateString()}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>`;
  } catch {
    userList.innerHTML = '<p style="color:var(--text-muted);">Failed.</p>';
  }
}

// Helper window function so inline onclick works for admin confirm buttons
window.confirmTxHelper = async id => {
  try {
    const res = await authFetch(`${NODE_API}/api/admin/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction_id: id })
    });
    if (!res) return;
    const data = await res.json();
    if (res.ok) {
      loadPending();
      showAlert(adminAlert, '✅ Confirmed!', 'success');
    } else showAlert(adminAlert, data.error);
  } catch {
    showAlert(adminAlert, 'Error.');
  }
};

// ===== AUTO LOGIN CHECK =====
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (Date.now() > payload.exp * 1000) {
      localStorage.removeItem('token');
      token = null;
    } else {
      currentUser = {
        id: payload.id,
        email: payload.email,
        is_admin: payload.is_admin
      };
      onAuthSuccess();
    }
  } catch {
    localStorage.removeItem('token');
    token = null;
  }
}