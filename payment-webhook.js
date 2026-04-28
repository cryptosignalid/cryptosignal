// api/payment-webhook.js — DOKU webhook + payment-status polling + chatid update
import crypto from 'crypto';
import {
  getInvoice, activateSubscriber, getSubscriber,
  updateSubscriberChatId, isProActive
} from './db.js';

const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY;
const TG_BOT_TOKEN    = process.env.TG_BOT_TOKEN;
const SITE_URL        = process.env.SITE_URL || 'https://cryptosignal.id';

// Send Telegram message to a single chat ID
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
  const msg = `🎉 *Welcome to CryptoSignal ${plan}!*

Your Pro account is now active. Here's what you'll receive:

⚡ *Breaking signals* (impact >80) — instant push
🇺🇸 *POTUS posts* — instant push  
😱 *Fear & Greed extremes* (<20 or >80) — instant push
🐋 *BTC whale mempool spikes* — instant push
📊 *15+ live sources* — CoinTelegraph, The Block, Decrypt, Reddit & more

_You now have full access at ${SITE_URL}_

Welcome aboard. 🚀`;
  return tgSend(chatId, msg);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET /api/payment-webhook?action=status&invoice=X  ── polling
  if (req.method === 'GET') {
    const { action, invoice, email } = req.query;

    // Payment status check
    if (action === 'status' && invoice) {
      const rec = await getInvoice(invoice).catch(() => null);
      if (!rec) return res.json({ status: 'PENDING' });
      const sub = rec.email ? await getSubscriber(rec.email).catch(() => null) : null;
      return res.json({
        status:    sub ? 'SUCCESS' : 'PENDING',
        email:     rec.email,
        tgChatId:  rec.tgChatId,
        plan:      rec.plan,
      });
    }

    // Pro status verification (user enters email to verify)
    if (action === 'verify' && email) {
      try {
        const sub = await getSubscriber(email);
        if (!sub) return res.json({ pro: false, message: 'No account found' });
        const active = await isProActive(email);
        return res.json({
          pro:         active,
          plan:        sub.plan,
          email:       sub.email,
          tgChatId:    sub.tgChatId,
          activatedAt: sub.activatedAt,
          expiresAt:   sub.expiresAt,
        });
      } catch (e) {
        return res.status(500).json({ pro: false, message: e.message });
      }
    }

    // Update chat ID for existing subscriber
    if (action === 'update-chatid' && email && req.query.chatId) {
      try {
        const updated = await updateSubscriberChatId(email, req.query.chatId);
        if (!updated) return res.json({ ok: false, message: 'Subscriber not found' });
        // Send confirmation TG message
        await tgSend(req.query.chatId,
          `✅ *CryptoSignal Pro — Telegram Activated!*\n\nYou'll now receive instant alerts for breaking signals, POTUS posts, and Fear & Greed extremes.\n\n_cryptosignal.id_`
        );
        return res.json({ ok: true, chatId: req.query.chatId });
      } catch (e) {
        return res.status(500).json({ ok: false, message: e.message });
      }
    }

    return res.status(400).json({ message: 'Missing action param' });
  }

  // ── POST — DOKU payment notification ──
  if (req.method === 'POST') {
    try {
      const body = req.body;
      console.log('DOKU webhook received:', JSON.stringify(body));

      const invoiceNumber = body?.order?.invoice_number;
      const status        = body?.transaction?.status || body?.purchase?.status;
      const tgChatId      = body?.additional_info?.tg_chat_id || '';
      const plan          = body?.additional_info?.plan || 'CryptoSignal Pro';
      const email         = body?.customer?.email || '';

      if (!invoiceNumber) return res.status(400).json({ message: 'No invoice number' });

      if (status === 'SUCCESS') {
        console.log(`✅ Payment SUCCESS: ${invoiceNumber} | ${email} | TG: ${tgChatId}`);

        // Activate subscriber in Redis
        const sub = await activateSubscriber({
          email, tgChatId, plan, invoiceNumber
        });

        // Send Telegram welcome message
        if (tgChatId) {
          const sent = await sendWelcomeTG(tgChatId, plan);
          console.log('TG welcome sent:', sent);
        }

        console.log('Subscriber activated:', JSON.stringify(sub));
      } else {
        console.log(`Payment ${status}: ${invoiceNumber}`);
        // Update invoice status so polling can detect it
        await getInvoice(invoiceNumber).catch(() => null);
      }

      return res.status(200).json({ message: 'OK' });
    } catch (err) {
      console.error('Webhook error:', err.message, err.stack);
      return res.status(500).json({ message: err.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
