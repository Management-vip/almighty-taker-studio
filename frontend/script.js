// ===== CONFIGURATION =====
const API_URL = 'https://your-backend.onrender.com'; // ⚠️ CHANGE THIS TO YOUR RENDER URL

// ===== STATE =====
let token = localStorage.getItem('token');
let currentUser = null;
let isLoginMode = false;

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

// ===== AUTH =====
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
    const res = await fetch(`${API_URL}${endpoint}`, {
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
    showAlert(authAlert, 'Network error. Is the backend running?');
  }
});

function onAuthSuccess() {
  hideAlert(authAlert);
  showSection(dashboardSection);
  navDashboard.style.display = 'inline';
  navAuthBtn.textContent = 'Dashboard';
  if (currentUser.is_admin) {
    navAdmin.style.display = 'inline';
  }
  loadBalance();
  loadTransactions();
}

// ===== BALANCE =====
async function loadBalance() {
  try {
    const res = await fetch(`${API_URL}/api/balance`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    balanceDisplay.textContent = data.coins || 0;
  } catch (e) {
    console.error('Balance load failed');
  }
}

// ===== TRANSACTIONS =====
async function loadTransactions() {
  try {
    const res = await fetch(`${API_URL}/api/transactions`, {
      headers: { Authorization: `Bearer ${token}` }
    });
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

// ===== DEPOSIT =====
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
    const res = await fetch(`${API_URL}/api/deposit/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`✅ Deposit requested!\n\nTransfer ${amount} coins to:\nBank: 1234567890\nName: Almighty Taker\n\nAdmin will confirm shortly.`);
      depositModal.classList.remove('active');
    } else {
      alert(data.error);
    }
  } catch (e) {
    alert('Network error.');
  }
});

// ===== GO LIVE =====
goLiveBtn.addEventListener('click', async () => {
  try {
    const res = await fetch(`${API_URL}/api/stream/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok) {
      liveModal.classList.add('active');
      document.getElementById('livePreview').innerHTML = '🎥 Live stream active — deepfake pipeline ready';
      loadBalance();
    } else {
      showAlert(dashAlert, data.error || 'Cannot start stream.');
    }
  } catch (e) {
    showAlert(dashAlert, 'Network error.');
  }
});

stopLiveBtn.addEventListener('click', () => {
  liveModal.classList.remove('active');
});

// ===== UPLOAD =====
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

  // Upload to backend
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      showAlert(dashAlert, '✅ File uploaded successfully!', 'success');
    } else {
      showAlert(dashAlert, data.error || 'Upload failed.');
    }
  } catch (e) {
    showAlert(dashAlert, 'Upload network error.');
  }
});

// ===== ADMIN =====
async function loadPending() {
  try {
    const res = await fetch(`${API_URL}/api/admin/pending`, {
      headers: { Authorization: `Bearer ${token}` }
    });
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
    const res = await fetch(`${API_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
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
    await fetch(`${API_URL}/api/admin/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ transaction_id: id })
    });
    loadPending();
    showAlert(adminAlert, '✅ Deposit confirmed!', 'success');
  } catch (e) {
    showAlert(adminAlert, 'Confirmation failed.');
  }
}

// ===== AUTO LOGIN CHECK =====
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    currentUser = { id: payload.id, email: payload.email, is_admin: payload.is_admin };
    onAuthSuccess();
  } catch (e) {
    localStorage.removeItem('token');
  }
}
