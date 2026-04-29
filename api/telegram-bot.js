// api/telegram-bot.js
// Handles incoming Telegram messages to @cryptosignalalert1bot
// When user sends /start → bot replies with their Chat ID
// 
// Setup: call this URL once to register webhook:
// https://api.telegram.org/bot8731034518:AAHTpe89-toSMtlV5N_gYu__Zy5-EVUU8tA/setWebhook?url=https://cryptosignal.id/api/telegram-bot

const BOT_TOKEN = process.env.TG_BOT_TOKEN || '8731034518:AAHTpe89-toSMtlV5N_gYu__Zy5-EVUU8tA';

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET' && req.query.setup === '1') {
    // Register webhook — call once
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=https://cryptosignal.id/api/telegram-bot`
    );
    const d = await r.json();
    return res.json(d);
  }

  if (req.method !== 'POST') return res.status(200).end();

  const body = req.body || {};
  const message = body.message;
  if (!message) return res.status(200).end();

  const chatId = message.chat?.id;
  const text = message.text || '';
  const firstName = message.from?.first_name || 'there';

  console.log(`Bot message from ${chatId}: ${text}`);

  if (text.startsWith('/start')) {
    await sendMessage(chatId, 
`⚡ *Welcome to CryptoSignal.id!*

Hi ${firstName}! Your Telegram is now connected.

Your *Chat ID* is:
\`${chatId}\`

📋 Copy this number and paste it on the CryptoSignal alerts page to activate your Pro alerts.

➡️ [Go to Alert Center](https://cryptosignal.id/alerts)

_You'll receive instant alerts for breaking crypto signals, whale moves, and POTUS posts._`
    );
  } else if (text.startsWith('/help')) {
    await sendMessage(chatId,
`⚡ *CryptoSignal.id Bot Commands*

/start — Connect your Telegram & get your Chat ID
/help — Show this help message
/stop — Unsubscribe from alerts

Need help? Visit cryptosignal.id or email support@cryptosignal.id`
    );
  } else if (text.startsWith('/stop')) {
    await sendMessage(chatId,
`✅ You've been unsubscribed from CryptoSignal alerts.

To reactivate, visit cryptosignal.id/alerts and reconnect your Telegram.`
    );
  } else {
    await sendMessage(chatId,
`⚡ *CryptoSignal.id*

Send /start to connect your Telegram and get your Chat ID.
Visit cryptosignal.id for live crypto signals.`
    );
  }

  return res.status(200).json({ ok: true });
};
