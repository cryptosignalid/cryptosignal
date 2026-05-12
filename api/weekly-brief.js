// api/weekly-brief.js — Monday AI briefing to all Pro subscribers
// Trigger: cron job or manual POST with BROADCAST_KEY
import { getAllChatIds } from './db.js';

const TG_BOT_TOKEN  = process.env.TG_BOT_TOKEN;
const BROADCAST_KEY = process.env.BROADCAST_SECRET || 'cs-broadcast-secret';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

async function tgSend(chatId, text) {
  if (!chatId || !TG_BOT_TOKEN) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
    });
    return (await r.json()).ok;
  } catch { return false; }
}

async function generateBriefing(context) {
  if (!ANTHROPIC_KEY) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `You are CryptoSignal AI. Write a concise Monday morning briefing for crypto traders.
Context: ${context}
Format as Telegram Markdown. Start with "🧠 *Weekly Signal Brief*" then cover:
1. Last week's key signals summary (2-3 bullets)  
2. What to watch this week (2-3 items)
3. One macro insight
4. Closing motivational line
Keep it under 400 words, professional tone. Use ⚡📈📉🌐 emojis sparingly.`
        }]
      })
    });
    const d = await r.json();
    return d.content?.[0]?.text || null;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const authHeader = req.headers['x-broadcast-key'];
  if (authHeader !== BROADCAST_KEY) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { context = 'General crypto market week. BTC range-bound. ETH upgrade upcoming. Macro: Fed meeting pending.' } = req.body || {};

    // Generate AI briefing
    const aiText = await generateBriefing(context);
    const fallback = `🧠 *Weekly Signal Brief — CryptoSignal Pro*\n\n📈 *Last Week Recap*\n• BTC showed resilience around key support levels\n• ETH upgrade news drove positive sentiment\n• Macro: Fed commentary created short-term volatility\n\n🌐 *Watch This Week*\n• CPI data release — high impact on rate expectations\n• BTC ETF weekly flow numbers\n• FOMC member speeches\n\n⚡ *Macro Insight*\nDXY weakness continues to provide tailwind for crypto assets.\n\n_Stay sharp. The signal matters. — CryptoSignal Pro_\n\n📡 cryptosignal.id`;
    const message = aiText || fallback;

    const chatIds = await getAllChatIds();
    if (chatIds.length === 0) return res.json({ sent: 0, total: 0 });

    let sent = 0;
    // Rate-limit: 30 messages/second Telegram limit
    for (let i = 0; i < chatIds.length; i++) {
      const ok = await tgSend(chatIds[i], message);
      if (ok) sent++;
      if (i > 0 && i % 25 === 0) await new Promise(r => setTimeout(r, 1000));
    }

    return res.json({ ok: true, sent, total: chatIds.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
