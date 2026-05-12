// api/streak.js — Daily visit tracker, streak counter, XP system
import { recordVisitAndStreak, getSubscriber, isProActive } from './db.js';

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;

async function tgSend(chatId, text) {
  if (!chatId || !TG_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  }).catch(() => {});
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });

  const active = await isProActive(email).catch(() => false);
  if (!active) return res.status(403).json({ error: 'Pro subscription required' });

  try {
    const result = await recordVisitAndStreak(email);
    const sub = await getSubscriber(email);

    // Notify on milestone streaks via Telegram
    if (result.xpGain > 0 && sub?.tgChatId) {
      const milestones = [7, 14, 30, 60, 100, 365];
      if (milestones.includes(result.streak)) {
        await tgSend(sub.tgChatId,
          `🔥 *${result.streak}-Day Streak!*\n\nYou've opened CryptoSignal ${result.streak} days in a row!\n` +
          `+${result.xpGain} XP earned · Total: *${result.xp} XP*\n` +
          `Rank: *${result.rank}*\n\n_Keep it up — don't break the streak!_`
        );
      }
      if (result.rankUp) {
        await tgSend(sub.tgChatId,
          `🏆 *Rank Up!* You are now a *${result.rank}*!\n\n` +
          `Total XP: ${result.xp} · Streak: ${result.streak} days\n\n_cryptosignal.id_`
        );
      }
    }

    return res.json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
