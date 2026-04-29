// api/referral.js — Referral system: generate codes, track conversions, reward referrers
import { getSubscriber, redis } from './db.js';

function generateCode(email) {
  return btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, email, code } = req.method === 'GET' ? req.query : req.body;

  // GET /api/referral?action=get-code&email=X — get or create referral code
  if (action === 'get-code' && email) {
    try {
      const refCode = generateCode(email);
      // Store code → email mapping
      await redis('SET', `ref:${refCode}`, email, 'EX', 31536000); // 1 year
      const refLink = `https://cryptosignal.id/?ref=${refCode}`;
      return res.json({ ok: true, code: refCode, link: refLink });
    } catch (e) {
      return res.status(500).json({ ok: false, message: e.message });
    }
  }

  // POST /api/referral — track a referral conversion (called when new Pro subscribes)
  if (req.method === 'POST' && action === 'convert' && code) {
    try {
      // Look up referrer
      const referrerEmail = await redis('GET', `ref:${code}`).catch(() => null);
      if (!referrerEmail) return res.json({ ok: false, message: 'Invalid referral code' });

      // Extend referrer subscription by 30 days
      const sub = await getSubscriber(referrerEmail).catch(() => null);
      if (sub && sub.status === 'active') {
        const currentExpiry = new Date(sub.expiresAt || Date.now());
        const newExpiry = new Date(currentExpiry.getTime() + 30 * 24 * 60 * 60 * 1000);
        const updated = { ...sub, expiresAt: newExpiry.toISOString() };
        await redis('SET', `sub:${referrerEmail.toLowerCase()}`, JSON.stringify(updated));

        // Track conversion count
        await redis('INCR', `ref:count:${code}`);

        console.log(`Referral converted: ${code} → ${referrerEmail} gets +30 days (new expiry: ${newExpiry.toISOString()})`);
        return res.json({ ok: true, referrer: referrerEmail, newExpiry: newExpiry.toISOString() });
      }
      return res.json({ ok: false, message: 'Referrer subscription not active' });
    } catch (e) {
      return res.status(500).json({ ok: false, message: e.message });
    }
  }

  // GET /api/referral?action=stats&email=X — get referral stats
  if (action === 'stats' && email) {
    try {
      const refCode = generateCode(email);
      const count = await redis('GET', `ref:count:${refCode}`).catch(() => '0');
      const refLink = `https://cryptosignal.id/?ref=${refCode}`;
      return res.json({ ok: true, code: refCode, link: refLink, conversions: parseInt(count || 0), freeMonthsEarned: parseInt(count || 0) });
    } catch (e) {
      return res.status(500).json({ ok: false, message: e.message });
    }
  }

  return res.status(400).json({ message: 'Missing required parameters' });
}
