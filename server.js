const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const botCtrl = require('./bot-control');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const USERS_PATH = path.join(__dirname, 'data', 'users.json');

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const sessions = {};

// --- Users helpers ---
function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));
}

// --- Login ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();

  if (!users[username] || users[username].password !== password)
    return res.status(401).json({ ok: false, message: 'Invalid credentials' });

  const token = Math.random().toString(36).slice(2);
  sessions[token] = {
    username,
    role: users[username].role,
    permissions: users[username].permissions || []
  };

  res.json({
    ok: true,
    token,
    username,
    role: users[username].role,
    permissions: users[username].permissions || []
  });
});

// --- Auth middleware ---
function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token || !sessions[token])
    return res.status(401).json({ ok: false, message: 'Not authenticated' });
  req.user = sessions[token];
  next();
}

// --- Bot endpoints ---
app.get('/api/status', (req, res) => res.json({ ok: true, bot: botCtrl.status() }));

app.post('/api/start', authMiddleware, (req, res) => {
  if (!req.user.permissions.includes('start_stop'))
    return res.status(403).json({ ok: false, message: 'No permission' });
  botCtrl.start(io);
  res.json({ ok: true, message: 'Bot starting...' });
});

app.post('/api/stop', authMiddleware, (req, res) => {
  if (!req.user.permissions.includes('start_stop'))
    return res.status(403).json({ ok: false, message: 'No permission' });
  botCtrl.stop();
  res.json({ ok: true, message: 'Bot stopping...' });
});

app.post('/api/chat', authMiddleware, (req, res) => {
  if (!req.user.permissions.includes('send_message'))
    return res.status(403).json({ ok: false, message: 'No permission' });
  const { message } = req.body;
  const ok = botCtrl.sendMessage(message);
  res.json({ ok, message });
});

// --- User management ---
app.get('/api/users', authMiddleware, (req, res) => {
  if (!req.user.permissions.includes('manage_users'))
    return res.status(403).json({ ok: false, message: 'No permission' });
  const users = loadUsers();
  res.json({ ok: true, users, currentUserPermissions: req.user.permissions });
});

app.post('/api/users', authMiddleware, (req, res) => {
  if (!req.user.permissions.includes('manage_users'))
    return res.status(403).json({ ok: false, message: 'No permission' });

  const { username, password, role, permissions } = req.body;
  if (!username || !password) return res.status(400).json({ ok: false, message: 'Missing fields' });

  const users = loadUsers();
  if (users[username]) return res.status(400).json({ ok: false, message: 'User exists' });

  users[username] = { password, role, permissions };
  saveUsers(users);
  res.json({ ok: true, message: 'User added' });
});

app.delete('/api/users/:username', authMiddleware, (req, res) => {
  if (!req.user.permissions.includes('manage_users'))
    return res.status(403).json({ ok: false, message: 'No permission' });

  const target = req.params.username;
  if (target === 'E.Crafters')
    return res.status(403).json({ ok: false, message: 'Cannot delete E.Crafters' });

  const users = loadUsers();
  if (!users[target]) return res.status(404).json({ ok: false, message: 'User not found' });

  delete users[target];
  saveUsers(users);
  res.json({ ok: true, message: 'Deleted' });
});

app.patch('/api/users/:username/permissions', authMiddleware, (req, res) => {
  if (!req.user.permissions.includes('manage_users'))
    return res.status(403).json({ ok: false, message: 'No permission' });

  const { username } = req.params;
  const { permission, value } = req.body;

  if (username === 'E.Crafters')
    return res.status(403).json({ ok: false, message: 'Cannot modify E.Crafters permissions' });

  const users = loadUsers();
  if (!users[username]) return res.status(404).json({ ok: false, message: 'User not found' });

  const userPerms = new Set(users[username].permissions || []);
  if (value) userPerms.add(permission);
  else userPerms.delete(permission);

  users[username].permissions = Array.from(userPerms);
  saveUsers(users);

  // refresh sessions
  for (const token in sessions) {
    if (sessions[token].username === username) sessions[token].permissions = users[username].permissions;
  }

  res.json({ ok: true, message: 'Permissions updated' });
});

// --- Socket.io ---
io.on('connection', socket => {
  socket.emit('bot-status', botCtrl.status());
  fs.readFile('./bot-log.json', 'utf8', (err, data) => {
    if (!err && data) socket.emit('bot-log-init', JSON.parse(data));
  });
  socket.on('send-message', msg => botCtrl.sendMessage(msg));
});

// --- Health check for Koyeb ---
app.get('/health', (req, res) => res.json({ ok: true, status: 'healthy' }));

// --- Start server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));

