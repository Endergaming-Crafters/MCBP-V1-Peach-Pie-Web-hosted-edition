import mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';
import fs from 'fs';

let bot = null;
let botState = { online: false };
let ioRef = null;
let allowReconnect = true; // Controls auto-reconnect

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

function emitLog(level, msg) {
  const entry = { ts: Date.now(), level, msg };
  console.log(`[BOT] ${level}: ${msg}`);
  if (ioRef) ioRef.emit('bot-log', entry);
}

export function start(io) {
  if (botState.online) {
    emitLog('info', 'Bot already running');
    return;
  }

  allowReconnect = true; // Reset flag on manual start
  ioRef = io;

  const mc = config.minecraft;
  const b = config.bot;

  emitLog('info', `Starting bot ${b.username} → ${mc.host}:${mc.port} (v${mc.version})`);

  bot = mineflayer.createBot({
    host: mc.host,
    port: mc.port,
    username: b.username,
    password: b.password || undefined,
    auth: mc.auth || 'offline',
    version: mc.version
  });

  botState.online = true;
  if (ioRef) ioRef.emit('bot-status', { online: true });

  bot.once('spawn', () => {
    emitLog('info', `Spawned as ${bot.username}`);

    // Handle AuthMe registration/login
    setTimeout(() => {
      try { bot.chat(`/register ${b.password} ${b.password}`); } catch(e){}
      try { bot.chat(`/login ${b.password}`); } catch(e){}
    }, 5000);

    keepAliveLoop();
  });

  bot.on('chat', (username, message) => {
    emitLog('chat', `<${username}> ${message}`);
    if (ioRef) ioRef.emit('bot-chat', { username, message, ts: Date.now() });
  });

  bot.on('message', (jsonMsg) => {
    const text = jsonMsg.toString();
    emitLog('message', text);
  });

  bot.on('kicked', (reason) => {
    emitLog('warn', `Kicked: ${reason}`);
  });

  bot.on('error', (err) => {
    emitLog('error', `Error: ${err.message || err}`);
  });

  bot.on('end', () => {
    emitLog('warn', 'Bot disconnected.');
    botState.online = false;
    if (ioRef) ioRef.emit('bot-status', { online: false });

    if (allowReconnect) {
      emitLog('info', 'Reconnecting in 10s...');
      setTimeout(() => start(ioRef), 10000);
    }
  });
}

export function stop() {
  allowReconnect = false; // Prevent auto-reconnect
  if (!bot) return;
  try { bot.quit('Shutting down (panel)'); } catch(e){}
  bot = null;
  botState.online = false;
  if (ioRef) ioRef.emit('bot-status', { online: false });
  emitLog('info', 'Bot stopped');
}

export function sendMessage(text) {
  if (!bot || !bot.chat) {
    emitLog('warn', 'Bot not connected');
    return false;
  }
  bot.chat(text);
  emitLog('info', `Sent chat: ${text}`);
  return true;
}

let keepAliveTimer = null;
function keepAliveLoop() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = setInterval(() => {
    if (!bot || !bot.entity) return;
    try {
      const dx = Math.floor(Math.random()*3)-1;
      const dz = Math.floor(Math.random()*3)-1;
      const pos = bot.entity.position.offset(dx,0,dz);
      bot.lookAt(pos);
      bot.setControlState('forward', true);
      setTimeout(()=>bot.setControlState('forward', false), 1000);
      bot.setControlState('jump', true);
      setTimeout(()=>bot.setControlState('jump', false), 500);
      bot.chat(''); // optional keep-alive message
    } catch(e){
      emitLog('error', `KeepAlive error: ${e.message||e}`);
    }
  }, 60000);
}

export function status() {
  return { online: botState.online, username: (bot && bot.username) || null };
}
