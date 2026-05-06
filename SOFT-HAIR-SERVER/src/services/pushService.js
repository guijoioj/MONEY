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

module.exports = { sendPush, isExpoPushToken };
