// api/support-bot.js — Agent 5: AI Customer Service Bot
// Deployed as Telegram webhook handler + web chat API
// Uses Claude API with CryptoSignal product context

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const TG_BOT_TOKEN = process.env.TG_SUPPORT_BOT_TOKEN || process.env.TG_BOT_TOKEN;

const SYSTEM_PROMPT = `You are the CryptoSignal.id customer support AI, representing a premium crypto intelligence platform for Indonesian traders.

Product facts:
- CryptoSignal.id: AI-powered crypto signal aggregator with 15+ live sources
- Free plan: 20 signals per refresh, 5 sources
- Pro Monthly: Rp449.000/month — unlimited signals, Telegram alerts, 15+ sources
- Pro Annual: Rp3.900.000/year (save 27%) — includes B2B API key
- Business API: Rp3.000.000/month — direct API access for trading firms
- Payment via DOKU: BCA VA, Mandiri VA, BNI, BRI, GoPay, OVO, DANA, QRIS, Indomaret
- Telegram alerts: users need to get Chat ID from @userinfobot and enter on cryptosignal.id/alerts
- Pro verification: go to cryptosignal.id/pro → scroll to "Already Pro?" → enter email
- Support email: support@cryptosignal.id
- Website: https://cryptosignal.id

Rules:
- Be helpful, professional, concise. Use friendly Indonesian if user writes in Indonesian.
- Never give financial advice or trading recommendations.
- For payment issues, direct to DOKU support or support@cryptosignal.id
- For technical bugs, collect: browser, device, error message, then escalate.
- Referral: each Pro user gets a unique link. 1 referral = 1 free month.`;

async function askClaude(messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', // Use Haiku for support (fast + cheap)
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  const d = await r.json();
  return d.content?.[0]?.text || 'Sorry, I am having trouble responding. Please email support@cryptosignal.id';
}

async function handleTelegramUpdate(update) {
  const msg = update.message;
  if (!msg?.text) return;
  const chatId = msg.chat.id;
  const userText = msg.text;

  // Simple conversation history (last 4 exchanges stored in KV would be ideal)
  const reply = await askClaude([{ role: 'user', content: userText }]);

  await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: 'Markdown' }),
  });
}

export default async function handler(req, res) {
  // Telegram webhook
  if (req.method === 'POST' && req.query.source === 'telegram') {
    await handleTelegramUpdate(req.body);
    return res.status(200).json({ ok: true });
  }

  // Web chat API
  if (req.method === 'POST' && req.body?.message) {
    const history = (req.body.history || []).slice(-8); // Last 4 exchanges
    const messages = [...history, { role: 'user', content: req.body.message }];
    const reply = await askClaude(messages);
    return res.json({ ok: true, reply, timestamp: new Date().toISOString() });
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
