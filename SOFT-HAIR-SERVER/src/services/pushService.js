/**
 * Push notification service usando Expo Push API diretamente (sem SDK ESM).
 */
const https = require('https');

function isExpoPushToken(token) {
  return typeof token === 'string' && /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

async function sendPush(pushToken, title, body, data = {}) {
  if (!isExpoPushToken(pushToken)) return;

  const payload = JSON.stringify([{ to: pushToken, sound: 'default', title, body, data }]);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'exp.host',
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      res.resume();
      resolve();
    });
    req.on('error', (e) => console.error('Push error:', e.message));
    req.write(payload);
    req.end();
  });
}

// [P5-B8] Batch push API — Expo aceita até 100 mensagens por request.
// Reduz custo + chance de hit rate limit.
async function sendPushBatch(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return;

  const validMessages = messages.filter(m => isExpoPushToken(m.to));
  if (validMessages.length === 0) return;

  const BATCH_SIZE = 100;
  const results = [];

  for (let i = 0; i < validMessages.length; i += BATCH_SIZE) {
    const chunk = validMessages.slice(i, i + BATCH_SIZE).map(m => ({
      to: m.to,
      sound: m.sound || 'default',
      title: m.title,
      body: m.body,
      data: m.data || {},
    }));
    const payload = JSON.stringify(chunk);

    await new Promise((resolve) => {
      const req = https.request({
        hostname: 'exp.host',
        path: '/--/api/v2/push/send',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', (e) => console.error('Push batch error:', e.message));
      req.write(payload);
      req.end();
    });
    results.push({ batch: i / BATCH_SIZE, count: chunk.length });
  }

  return results;
}

module.exports = { sendPush, sendPushBatch, isExpoPushToken };
