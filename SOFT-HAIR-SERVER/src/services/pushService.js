const { Expo } = require('expo-server-sdk');
const expo = new Expo();

async function sendPush(pushToken, title, body, data = {}) {
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;
  try {
    await expo.sendPushNotificationsAsync([{
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
    }]);
  } catch (e) {
    console.error('Push error:', e.message);
  }
}

module.exports = { sendPush };
