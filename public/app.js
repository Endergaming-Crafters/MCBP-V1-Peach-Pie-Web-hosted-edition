// app.js (FULL UPDATED VERSION WITH BACKGROUND ZOOM)

let token = null;
const socket = io();
let botUsername = null;
let currentUserPermissions = [];

// Define permission options (must match users.json)
const PERM_OPTIONS = [
  { key: 'view_console', label: 'View Console' },
  { key: 'send_message', label: 'Send Message' },
  { key: 'start_stop', label: 'Start / Stop Bot' },
  { key: 'manage_users', label: 'Manage Users' }
];

// --- Helper: render permission checkboxes for user creation area ---
function renderCreatePermissionCheckboxes() {
  const container = document.getElementById('permission-checkboxes');
  if (!container) return;
  container.innerHTML = '';
  PERM_OPTIONS.forEach(opt => {
    const label = document.createElement('label');
    label.style.marginRight = '8px';
    label.innerHTML = `<input type="checkbox" data-perm="${opt.key}" /> ${opt.label}`;
    container.appendChild(label);
  });
}

// --- Login ---
function login() {
  const u = document.getElementById('username').value;
  const p = document.getElementById('password').value;
  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p })
  })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        token = data.token;
        botUsername = data.username;
        currentUserPermissions = data.permissions || [];
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('panel').style.display = 'block';
        loadUsers();
      } else {
        document.getElementById('login-msg').innerText = data.message;
      }
    })
    .catch(err => {
      document.getElementById('login-msg').innerText = 'Network error';
      console.error(err);
    });
}

// --- Logout ---
function logout() {
  token = null;
  botUsername = null;
  currentUserPermissions = [];
  document.getElementById('panel').style.display = 'none';
  document.getElementById('login-section').style.display = 'block';
  document.body.classList.remove('zoomed');
}

// --- Sections ---
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  // Smooth zoom effect when entering/exiting user management
  if (id === 'user-management') {
    document.body.classList.add('zoomed');
  } else {
    document.body.classList.remove('zoomed');
  }
}

// --- Bot actions ---
function startBot() {
  if (!currentUserPermissions.includes('start_stop')) {
    alert('You do not have permission to start the bot.');
    return;
  }
  fetch('/api/start', { method: 'POST', headers: { 'x-auth-token': token } })
    .then(() => appendLog('[ACTION] Bot start requested.'))
    .catch(() => alert('Network error while starting bot'));
}

function stopBot() {
  if (!currentUserPermissions.includes('start_stop')) {
    alert('You do not have permission to stop the bot.');
    return;
  }
  fetch('/api/stop', { method: 'POST', headers: { 'x-auth-token': token } })
    .then(() => appendLog('[ACTION] Bot stop requested.'))
    .catch(() => alert('Network error while stopping bot'));
}

function sendMsg() {
  const m = document.getElementById('chat-msg').value.trim();
  if (!m) return;
  if (!currentUserPermissions.includes('send_message')) {
    alert('You do not have permission to send messages.');
    return;
  }
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
    body: JSON.stringify({ message: m })
  });
  document.getElementById('chat-msg').value = '';
}

// --- Bot console ---
const botConsole = document.getElementById('bot-console');
function appendLog(html) {
  botConsole.innerHTML += html + '<br>';
  botConsole.scrollTop = botConsole.scrollHeight;
}

socket.on('bot-log', e =>
  appendLog(`[${new Date(e.ts).toLocaleTimeString()}][${e.level}] ${e.msg}`)
);
socket.on('bot-chat', e => {
  const color = e.username === botUsername ? '#4caf50' : '#0ff';
  appendLog(
    `<span style="color:${color}">[${new Date(e.ts).toLocaleTimeString()}]&lt;${e.username}&gt; ${e.message}</span>`
  );
});
socket.on('bot-status', e =>
  appendLog(`[BOT STATUS] ${e.online ? 'Online' : 'Offline'}`)
);

// --- User management ---
function loadUsers() {
  fetch('/api/users', { headers: { 'x-auth-token': token } })
    .then(r => r.json())
    .then(data => {
      if (!data.ok) {
        if (data.message) alert(data.message);
        return;
      }

      if (data.currentUserPermissions)
        currentUserPermissions = data.currentUserPermissions;

      const tbody = document.querySelector('#users-table tbody');
      tbody.innerHTML = '';

      for (const u in data.users) {
        const user = data.users[u];
        const isProtected = u === 'E.Crafters';

        const permsHtml = PERM_OPTIONS.map(opt => {
          const checked = user.permissions?.includes(opt.key) ? 'checked' : '';
          const canEdit =
            currentUserPermissions.includes('manage_users') && !isProtected;
          const disabled = canEdit ? '' : 'disabled';
          return `<label style="margin-right:8px;"><input type="checkbox" data-username="${u}" data-perm="${opt.key}" ${checked} ${disabled}> ${opt.label}</label>`;
        }).join(' ');

        const canDelete =
          currentUserPermissions.includes('manage_users') && !isProtected;

        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${u}</td><td>${user.role}</td><td>${permsHtml}</td><td>${
          canDelete
            ? `<button class="delete-btn" data-username="${u}">Delete</button>`
            : ''
        }</td>`;
        tbody.appendChild(tr);
      }

      // permission change listeners
      tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        if (cb._bound) return;
        cb._bound = true;
        cb.addEventListener('change', e => {
          const username = e.target.dataset.username;
          const perm = e.target.dataset.perm;
          const value = e.target.checked;
          if (username === 'E.Crafters') {
            alert('E.Crafters permissions cannot be modified.');
            loadUsers();
            return;
          }
          updatePermissions(username, perm, value);
        });
      });

      // delete buttons
      tbody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const userToDelete = btn.dataset.username;
          deleteUser(userToDelete);
        });
      });
    })
    .catch(err => {
      console.error('Failed to load users', err);
      alert('Failed to load users (network error)');
    });
}

function addUser() {
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value;
  const role = document.getElementById('new-role').value;

  if (!username || !password) {
    alert('Username and password are required');
    return;
  }

  const perms = Array.from(
    document.querySelectorAll(
      '#permission-checkboxes input[type="checkbox"]:checked'
    )
  )
    .map(i => i.dataset.perm)
    .filter(Boolean);

  fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': token
    },
    body: JSON.stringify({ username, password, role, permissions: perms })
  })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        loadUsers();
        document.getElementById('new-username').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('new-role').value = 'user';
        document
          .querySelectorAll('#permission-checkboxes input[type="checkbox"]')
          .forEach(cb => (cb.checked = false));
      } else alert(data.message || 'Failed to create user');
    })
    .catch(err => {
      console.error('Add user error', err);
      alert('Network error while creating user');
    });
}

function deleteUser(username) {
  if (username === 'E.Crafters') {
    alert('This account cannot be deleted.');
    return;
  }
  if (!confirm(`Delete user ${username}?`)) return;
  fetch(`/api/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    headers: { 'x-auth-token': token }
  })
    .then(r => r.json())
    .then(data => {
      if (data.ok) loadUsers();
      else alert(data.message || 'Failed to delete user');
    })
    .catch(err => {
      console.error('Delete user error', err);
      alert('Network error while deleting user');
    });
}

function updatePermissions(username, perm, value) {
  fetch(`/api/users/${encodeURIComponent(username)}/permissions`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': token
    },
    body: JSON.stringify({ permission: perm, value })
  })
    .then(r => r.json())
    .then(data => {
      if (!data.ok) {
        alert(data.message || 'Failed to update permission');
        loadUsers();
      }
    })
    .catch(err => {
      console.error('Update permission error', err);
      alert('Network error while updating permission');
      loadUsers();
    });
}

// --- Initialize UI ---
window.addEventListener('DOMContentLoaded', () => {
  renderCreatePermissionCheckboxes();

  const chatInput = document.getElementById('chat-msg');
  if (chatInput) {
    chatInput.style.width = '100%';
    chatInput.style.height = '48px';
    chatInput.style.padding = '12px 16px';
    chatInput.style.borderRadius = '12px';
    chatInput.style.border = '1px solid #555';
    chatInput.style.background = '#333';
    chatInput.style.color = '#fff';
    chatInput.style.fontSize = '1.05em';
  }
});
