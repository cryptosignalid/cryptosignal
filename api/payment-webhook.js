// payment-webhook.js — DOKU webhook + status polling (CommonJS)
const crypto = require('crypto');

const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY;
const TG_BOT_TOKEN    = process.env.TG_BOT_TOKEN || '8655654640:AAEAWBWG9u52gNZi1Me60yOiFh9oZ0csQtc';
const SITE_URL        = process.env.SITE_URL || 'https://cryptosignal.id';

// Upstash Redis helpers (inline)
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function redis(method, path) {
  if (!KV_URL || !KV_TOKEN) throw new Error('Missing KV env vars');
  const res = await fetch(`${KV_URL}/${path}`, {
    method: method || 'GET',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Redis error: ${res.status}`);
  const { result } = await res.json();
  return result;
}

async function redisGet(key) {
  const raw = await redis('GET', `get/${encodeURIComponent(key)}`);
  return raw ? JSON.parse(raw) : null;
}

async function redisSet(key, value, exSeconds) {
  const encoded = encodeURIComponent(JSON.stringify(value));
  const path = exSeconds
    ? `set/${encodeURIComponent(key)}/${encoded}/ex/${exSeconds}`
    : `set/${encodeURIComponent(key)}/${encoded}`;
  return redis('GET', path);
}

async function redisSadd(key, member) {
  return redis('GET', `sadd/${encodeURIComponent(key)}/${encodeURIComponent(member)}`);
}

// DB functions
async function getInvoice(invoiceNumber) {
  return redisGet(`invoice:${invoiceNumber}`);
}

async function getSubscriber(email) {
  return redisGet(`sub:${email.toLowerCase()}`);
}

async function activateSubscriber({ email, tgChatId, plan, invoiceNumber }) {
  const sub = {
    email, tgChatId: tgChatId || '', plan, invoiceNumber,
    activatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  };
  await redisSet(`sub:${email.toLowerCase()}`, sub);
  if (tgChatId) await redisSadd('chatids', tgChatId);
  return sub;
}

async function updateSubscriberChatId(email, tgChatId) {
  const sub = await getSubscriber(email);
  if (!sub) return null;
  const updated = { ...sub, tgChatId };
  await redisSet(`sub:${email.toLowerCase()}`, updated);
  if (tgChatId) await redisSadd('chatids', tgChatId);
  return updated;
}

async function isProActive(email) {
  const sub = await getSubscriber(email);
  if (!sub || sub.status !== 'active') return false;
  if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) return false;
  return true;
}

// Telegram helper
async function tgSend(chatId, text) {
  if (!chatId || !TG_BOT_TOKEN) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    return (await r.json()).ok;
  } catch { return false; }
}

async function sendWelcomeTG(chatId, plan) {
  const msg = `🎉 *Welcome to CryptoSignal Pro!*\n\nYour account is now active.\n\n⚡ Breaking signals — instant push\n🐋 Whale alerts — instant push\n😱 Fear & Greed extremes — instant push\n\n_${SITE_URL}_\n\nWelcome aboard! 🚀`;
  return tgSend(chatId, msg);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET actions
  if (req.method === 'GET') {
    const { action, invoice, email } = req.query;

    if (action === 'status' && invoice) {
      const rec = await getInvoice(invoice).catch(() => null);
      if (!rec) return res.json({ status: 'PENDING' });
      const sub = rec.email ? await getSubscriber(rec.email).catch(() => null) : null;
      return res.json({ status: sub ? 'SUCCESS' : 'PENDING', email: rec.email, tgChatId: rec.tgChatId, plan: rec.plan });
    }

    if (action === 'verify' && email) {
      try {
        const sub = await getSubscriber(email);
        if (!sub) return res.json({ pro: false, message: 'No account found' });
        const active = await isProActive(email);
        return res.json({ pro: active, plan: sub.plan, email: sub.email, tgChatId: sub.tgChatId, expiresAt: sub.expiresAt });
      } catch (e) {
        return res.status(500).json({ pro: false, message: e.message });
      }
    }

    if (action === 'update-chatid' && email && req.query.chatId) {
      try {
        const updated = await updateSubscriberChatId(email, req.query.chatId);
        if (!updated) return res.json({ ok: false, message: 'Subscriber not found' });
        await tgSend(req.query.chatId, `✅ *CryptoSignal Pro — Telegram Activated!*\n\nYou'll now receive instant alerts.\n\n_cryptosignal.id_`);
        return res.json({ ok: true, chatId: req.query.chatId });
      } catch (e) {
        return res.status(500).json({ ok: false, message: e.message });
      }
    }

    // Send test Telegram message directly to chatId
    if (action === 'test-tg' && req.query.chatId) {
      const chatId = req.query.chatId;
      const userEmail = req.query.email || 'Pro Member';
      const msg = `⚡ *CryptoSignal Pro — Test Alert*

✅ Your Telegram is connected and working!

Here's what your real alerts look like:

📈 *BULLISH* · Impact *87/100* · Trust *9.2/10*
*BlackRock IBIT Bitcoin ETF crosses $32B AUM*
Fastest ETF milestone in Wall Street history.

🪙 #BTC · 📡 Bloomberg Intelligence

_You'll receive alerts like this instantly when breaking crypto news hits._

🌐 cryptosignal.id`;

      const sent = await tgSend(chatId, msg);
      if (sent) {
        return res.json({ ok: true, message: 'Test message sent!' });
      } else {
        return res.status(400).json({ ok: false, message: 'Failed to send — check Chat ID and bot setup' });
      }
    }

    return res.status(400).json({ message: 'Missing action param' });
  }

  // POST — DOKU webhook
  if (req.method === 'POST') {
    try {
      const body = req.body;
      console.log('DOKU webhook:', JSON.stringify(body));

      const invoiceNumber = body?.order?.invoice_number;
      const status        = body?.transaction?.status || body?.purchase?.status;
      const tgChatId      = body?.additional_info?.tg_chat_id || '';
      const plan          = body?.additional_info?.plan || 'CryptoSignal Pro';
      const email         = body?.customer?.email || '';

      if (!invoiceNumber) return res.status(400).json({ message: 'No invoice number' });

      if (status === 'SUCCESS') {
        const sub = await activateSubscriber({ email, tgChatId, plan, invoiceNumber });
        if (tgChatId) await sendWelcomeTG(tgChatId, plan);
        console.log('Activated:', sub.email);
      }

      return res.status(200).json({ message: 'OK' });
    } catch (err) {
      console.error('Webhook error:', err.message);
      return res.status(500).json({ message: err.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
};
