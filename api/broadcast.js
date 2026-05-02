// api/broadcast.js — Send Telegram alerts to ALL Pro subscribers
// Called internally by the main feed's alert system
// POST /api/broadcast with { message, type, impact }

import { getAllChatIds } from './db.js';

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const BROADCAST_KEY = process.env.BROADCAST_SECRET || 'cs-broadcast-secret';

async function tgSend(chatId, text) {
  if (!chatId || !TG_BOT_TOKEN) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:               chatId,
        text,
        parse_mode:            'Markdown',
        disable_web_page_preview: false,
      }),
    });
    const d = await r.json();
    if (!d.ok) console.log(`TG failed for ${chatId}:`, d.description);
    return d.ok;
  } catch (e) {
    console.error('TG error:', e.message);
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  // Validate internal broadcast key
  const authHeader = req.headers['x-broadcast-key'];
  if (authHeader !== BROADCAST_KEY) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { message, articleTitle, articleUrl, signalType, impact, source, coins } = req.body;

    if (!message && !articleTitle) {
      return res.status(400).json({ message: 'Missing message or articleTitle' });
    }

    // Get all Pro subscriber chat IDs from Redis
    const chatIds = await getAllChatIds();
    console.log(`Broadcasting to ${chatIds.length} Pro subscribers`);

    if (chatIds.length === 0) {
      return res.json({ sent: 0, total: 0, message: 'No subscribers' });
    }

    // Build formatted Telegram message
    const ico = { break:'⚡',bull:'📈',bear:'📉',whale:'🐋',reg:'⚖️',potus:'🇺🇸',hoax:'🚫',neutral:'📰' };
    const lbl = { break:'BREAKING',bull:'BULLISH',bear:'BEARISH',whale:'WHALE',reg:'REGULATION',potus:'POTUS SIGNAL',hoax:'AI FLAGGED',neutral:'NEWS' };
    const type = signalType || 'neutral';

    const tgMsg = message || [
      `${ico[type]||'📰'} *${lbl[type]||'NEWS'}*`,
      `Impact: *${impact||'—'}/100*`,
      '',
      `*${(articleTitle||'').replace(/[*_`[\]()~>#+=|{}.!-]/g, '\\$&').substring(0, 200)}*`,
      '',
      source ? `📡 ${source}` : '',
      coins?.length ? `🪙 ${coins.slice(0,4).join(', ')}` : '',
      articleUrl ? `\n[→ Read Article](${articleUrl})` : '',
      '',
      '_cryptosignal.id — Pro Alert_',
    ].filter(Boolean).join('\n');

    // Send to all subscribers with 50ms delay to respect TG rate limits
    let sent = 0, failed = 0;
    for (const chatId of chatIds) {
      const ok = await tgSend(chatId, tgMsg);
      if (ok) sent++; else failed++;
      await new Promise(r => setTimeout(r, 50)); // TG rate limit: 30 msg/sec
    }

    console.log(`Broadcast complete: ${sent} sent, ${failed} failed`);
    return res.json({ sent, failed, total: chatIds.length });

  } catch (err) {
    console.error('Broadcast error:', err.message);
    return res.status(500).json({ message: err.message });
  }
}
