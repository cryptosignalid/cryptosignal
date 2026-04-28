// api/payment-webhook.js
// Receives DOKU payment notifications and activates Pro access
// Also handles payment-status polling from the frontend

import crypto from 'crypto';

const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY;
const TG_BOT_TOKEN    = process.env.TG_BOT_TOKEN;    // Your Telegram bot token

// Simple in-memory store (use Upstash Redis / Supabase in production)
// For Vercel: add KV storage or use a free Upstash Redis instance
const paymentStore = {}; // { invoiceNumber: { status, tgChatId, plan, email } }

// Verify DOKU webhook signature
function verifyWebhookSignature(req) {
  try {
    const clientId   = req.headers['client-id'];
    const requestId  = req.headers['request-id'];
    const timestamp  = req.headers['request-timestamp'];
    const signature  = req.headers['signature'];
    const digest     = req.headers['digest'];

    const componentToSign = [
      'Client-Id:' + clientId,
      'Request-Id:' + requestId,
      'Request-Timestamp:' + timestamp,
      'Request-Target:' + '/api/payment-webhook',
      'Digest:' + digest,
    ].join('\n');

    const expected = 'HMACSHA256=' + crypto
      .createHmac('sha256', DOKU_SECRET_KEY)
      .update(componentToSign)
      .digest('base64');

    return signature === expected;
  } catch (e) {
    return false;
  }
}

// Send Telegram welcome message to new Pro subscriber
async function sendProWelcome(chatId, planName) {
  if (!chatId || !TG_BOT_TOKEN) return;

  const msg = `🎉 *Payment Confirmed — Welcome to ${planName}!*

Your CryptoSignal Pro account is now active. Here's what's live:

⚡ Breaking signals (impact >80) → instant push
🇺🇸 POTUS Truth Social posts → instant push  
😱 Extreme Fear & Greed (<20 or >80) → instant push
🐋 BTC whale mempool spike → instant push
📰 High-trust signals from 15+ sources

_You're now in the top tier of crypto intelligence. Stay ahead._ 🚀

Visit cryptosignal.id to see your live feed.`;

  await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: msg,
      parse_mode: 'Markdown',
    }),
  }).catch(e => console.error('TG send error:', e));
}

export default async function handler(req, res) {
  // ── GET: payment status polling (from frontend) ──
  if (req.method === 'GET') {
    const invoice = req.query.invoice;
    if (!invoice) return res.status(400).json({ message: 'Missing invoice' });

    const record = paymentStore[invoice];
    if (!record) return res.status(200).json({ status: 'PENDING' });
    return res.status(200).json(record);
  }

  // ── POST: DOKU webhook notification ──
  if (req.method === 'POST') {
    // Verify signature in production
    // if (!verifyWebhookSignature(req)) {
    //   return res.status(401).json({ message: 'Invalid signature' });
    // }

    try {
      const body = req.body;
      console.log('DOKU webhook:', JSON.stringify(body));

      const invoice  = body?.order?.invoice_number;
      const status   = body?.transaction?.status;         // SUCCESS | FAILED | EXPIRED
      const tgChatId = body?.additional_info?.tg_chat_id;
      const plan     = body?.additional_info?.plan || 'CryptoSignal Pro';
      const email    = body?.customer?.email;

      if (!invoice) return res.status(400).json({ message: 'No invoice number' });

      // Store payment result
      paymentStore[invoice] = { status, tgChatId, plan, email, timestamp: Date.now() };

      // On success, activate Telegram
      if (status === 'SUCCESS') {
        console.log(`✅ Payment SUCCESS: ${invoice} | Plan: ${plan} | TG: ${tgChatId}`);
        if (tgChatId) {
          await sendProWelcome(tgChatId, plan);
        }
        // TODO: In production, save to database:
        // await db.insert('pro_subscribers', { email, tgChatId, plan, activatedAt: new Date() });
      }

      return res.status(200).json({ message: 'OK' });
    } catch (err) {
      console.error('Webhook error:', err);
      return res.status(500).json({ message: err.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
