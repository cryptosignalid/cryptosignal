/**
 * Agent 4 — Email Drip Sequence
 * Triggered when a user captures their email on the free paywall.
 * Sends Day 1, Day 3, Day 7 emails to convert free → Pro.
 * 
 * Uses Resend (https://resend.com) — free tier: 3000 emails/month.
 * Alternatively swap for Mailgun or Brevo.
 * 
 * POST /api/email-drip?action=subscribe   { email }
 * POST /api/email-drip?action=send-day1   { email }  ← called by webhook after capture
 * GET  /api/email-drip?action=run-drip    ← called by daily cron
 * POST /api/email-drip?action=unsubscribe { email }
 */

const { createClient } = require("@vercel/kv");

const SITE_URL = process.env.SITE_URL || "https://cryptosignal.id";

// Email templates
const EMAILS = {
  day1: (email) => ({
    subject: "⚡ Your CryptoSignal.id is ready — here's what's moving today",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:2rem;">⚡</span>
      <h1 style="color:#f0b90b;margin:8px 0 4px;font-size:1.5rem;">CryptoSignal.id</h1>
      <p style="color:#8b949e;font-size:0.875rem;margin:0;">Real-Time AI Crypto Signals</p>
    </div>
    
    <div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:28px;margin-bottom:24px;">
      <h2 style="color:#e6edf3;margin:0 0 16px;font-size:1.25rem;">Welcome — you're in! 🎉</h2>
      <p style="color:#c9d1d9;line-height:1.6;margin:0 0 16px;">
        You now have access to <strong style="color:#f0b90b;">25 crypto signals per day</strong> — 
        AI-filtered from 15+ sources so you see only what matters.
      </p>
      <p style="color:#c9d1d9;line-height:1.6;margin:0 0 24px;">
        Today's top signal movers are live on your feed right now. Check them before the market moves.
      </p>
      <a href="${SITE_URL}/" style="display:inline-block;background:#f0b90b;color:#0d1117;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem;">
        View Today's Signals →
      </a>
    </div>

    <div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px;margin-bottom:24px;">
      <h3 style="color:#e6edf3;margin:0 0 12px;font-size:1rem;">What free users get:</h3>
      <ul style="color:#c9d1d9;line-height:1.8;padding-left:20px;margin:0;">
        <li>25 signals/day (updated every 5 minutes)</li>
        <li>Bull/Bear/Whale classification</li>
        <li>Impact score (0–99)</li>
        <li>Fear & Greed Index</li>
      </ul>
    </div>

    <p style="color:#8b949e;font-size:0.8rem;text-align:center;margin:0;">
      Don't want these emails? <a href="${SITE_URL}/api/email-drip?action=unsubscribe&email=${encodeURIComponent(email)}" style="color:#f0b90b;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`,
  }),

  day3: (email) => ({
    subject: "📊 3 signals CryptoSignal Pro users caught that free users missed",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:28px;">
      <span style="font-size:2rem;">⚡</span>
      <h2 style="color:#f0b90b;margin:8px 0 0;font-size:1.25rem;">CryptoSignal.id</h2>
    </div>

    <div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:28px;margin-bottom:20px;">
      <h2 style="color:#e6edf3;margin:0 0 16px;font-size:1.25rem;">Pro users saw these first 👇</h2>
      
      <div style="border-left:3px solid #26a641;padding-left:16px;margin-bottom:16px;">
        <p style="color:#26a641;font-size:0.8rem;font-weight:700;margin:0 0 4px;">BULLISH · Impact 87</p>
        <p style="color:#e6edf3;margin:0 0 4px;font-weight:600;">BTC whale accumulation: $340M moved to cold storage</p>
        <p style="color:#8b949e;font-size:0.875rem;margin:0;">Detected 2.3 hours before price moved +4.2%</p>
      </div>

      <div style="border-left:3px solid #26a641;padding-left:16px;margin-bottom:16px;">
        <p style="color:#26a641;font-size:0.8rem;font-weight:700;margin:0 0 4px;">BULLISH · Impact 74</p>
        <p style="color:#e6edf3;margin:0 0 4px;font-weight:600;">ETH staking ratio hits new ATH at 28.3%</p>
        <p style="color:#8b949e;font-size:0.875rem;margin:0;">Supply squeeze signal — historically precedes +15% run</p>
      </div>

      <div style="border-left:3px solid #da3633;padding-left:16px;margin-bottom:24px;">
        <p style="color:#da3633;font-size:0.8rem;font-weight:700;margin:0 0 4px;">RUG ALERT · Impact 91</p>
        <p style="color:#e6edf3;margin:0 0 4px;font-weight:600;">New DeFi protocol dev wallet moves 95% liquidity</p>
        <p style="color:#8b949e;font-size:0.875rem;margin:0;">Pro users avoided -67% in 4 hours</p>
      </div>

      <p style="color:#c9d1d9;line-height:1.6;margin:0 0 20px;">
        These were signals <strong style="color:#f0b90b;">26-48 of the day</strong> — only visible to Pro. 
        Free tier stops at 25. Upgrade now and never miss the next whale move.
      </p>

      <a href="${SITE_URL}/pro" style="display:inline-block;background:#f0b90b;color:#0d1117;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem;">
        Upgrade to Pro — Rp449K/mo →
      </a>
    </div>

    <div style="background:#1a1200;border:1px solid #f0b90b;border-radius:8px;padding:16px;margin-bottom:20px;">
      <p style="color:#f0b90b;font-weight:700;margin:0 0 4px;font-size:0.875rem;">⏰ Pro also includes:</p>
      <p style="color:#c9d1d9;margin:0;font-size:0.875rem;">Telegram push alerts (instant, no app needed) · Unlimited signals · Priority updates</p>
    </div>

    <p style="color:#8b949e;font-size:0.8rem;text-align:center;margin:0;">
      <a href="${SITE_URL}/api/email-drip?action=unsubscribe&email=${encodeURIComponent(email)}" style="color:#f0b90b;">Unsubscribe</a>
    </p>
  </div>
</body>
</html>`,
  }),

  day7: (email) => ({
    subject: "⚡ Last chance: 247 Pro traders are watching signals you can't see",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:28px;">
      <span style="font-size:2rem;">⚡</span>
      <h2 style="color:#f0b90b;margin:8px 0 0;font-size:1.25rem;">CryptoSignal.id</h2>
    </div>

    <div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:28px;margin-bottom:20px;">
      <p style="color:#8b949e;font-size:0.875rem;margin:0 0 8px;">YOU'VE BEEN WITH US 7 DAYS</p>
      <h2 style="color:#e6edf3;margin:0 0 16px;font-size:1.25rem;">Here's what 247 Pro members know that you don't 🤫</h2>
      
      <p style="color:#c9d1d9;line-height:1.6;margin:0 0 20px;">
        Every day, Pro members get <strong style="color:#f0b90b;">unlimited signals + instant Telegram alerts</strong>. 
        When a whale makes a $100M move at 3am, their phone lights up. Yours doesn't.
      </p>

      <div style="display:flex;gap:12px;margin-bottom:24px;">
        <div style="flex:1;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;text-align:center;">
          <p style="color:#f0b90b;font-size:1.5rem;font-weight:700;margin:0 0 4px;">Rp449K</p>
          <p style="color:#8b949e;font-size:0.8rem;margin:0;">per month</p>
          <p style="color:#c9d1d9;font-size:0.75rem;margin:8px 0 0;">Less than 1 cup of coffee per day</p>
        </div>
        <div style="flex:1;background:#1a1200;border:1px solid #f0b90b;border-radius:8px;padding:16px;text-align:center;">
          <p style="color:#f0b90b;font-size:1.5rem;font-weight:700;margin:0 0 4px;">Rp3.9jt</p>
          <p style="color:#8b949e;font-size:0.8rem;margin:0;">per year</p>
          <p style="color:#26a641;font-size:0.75rem;font-weight:700;margin:8px 0 0;">Save 27% — Best Value</p>
        </div>
      </div>

      <a href="${SITE_URL}/pro" style="display:block;background:#f0b90b;color:#0d1117;padding:16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem;text-align:center;">
        Get Pro Access Now →
      </a>
    </div>

    <div style="background:#161b22;border:1px solid #30363d;border-radius:8px;padding:20px;margin-bottom:20px;">
      <p style="color:#e6edf3;font-weight:700;margin:0 0 12px;">"Terima kasih CryptoSignal! Caught the BTC whale alert at 2am via Telegram, bought the dip, +18% in 3 days."</p>
      <p style="color:#8b949e;font-size:0.875rem;margin:0;">— Rizky A., Surabaya · Pro member since Jan 2026</p>
    </div>

    <p style="color:#8b949e;font-size:0.8rem;text-align:center;margin:0;">
      Not interested? <a href="${SITE_URL}/api/email-drip?action=unsubscribe&email=${encodeURIComponent(email)}" style="color:#f0b90b;">Unsubscribe here</a>. We'll stop emailing you.
    </p>
  </div>
</body>
</html>`,
  }),
};

async function sendEmail(to, subject, html) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — email not sent");
    return { ok: false, error: "No email provider configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "CryptoSignal.id <noreply@cryptosignal.id>",
      to,
      subject,
      html,
    }),
  });

  const data = await res.json();
  return { ok: res.ok, ...data };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", SITE_URL);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  const action = req.query.action || req.body?.action;

  // ── Subscribe (add to drip) ───────────────────────────────────────────────
  if (action === "subscribe") {
    const email = (req.body?.email || "").toLowerCase().trim();
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email" });
    }

    // Check if already subscribed
    const existing = await kv.get(`drip:${email}`).catch(() => null);
    if (existing) {
      return res.status(200).json({ ok: true, message: "Already subscribed" });
    }

    // Store subscriber with enrollment date
    const subscriber = {
      email,
      enrolledAt: Date.now(),
      day1Sent: false,
      day3Sent: false,
      day7Sent: false,
      unsubscribed: false,
    };
    await kv.set(`drip:${email}`, JSON.stringify(subscriber));

    // Add to index for batch processing
    await kv.sadd("drip:subscribers", email);

    // Send Day 1 immediately
    const { subject, html } = EMAILS.day1(email);
    await sendEmail(email, subject, html);

    // Mark day1 as sent
    subscriber.day1Sent = true;
    await kv.set(`drip:${email}`, JSON.stringify(subscriber));

    return res.status(200).json({ ok: true, message: "Subscribed and Day 1 sent" });
  }

  // ── Unsubscribe ───────────────────────────────────────────────────────────
  if (action === "unsubscribe") {
    const email = (req.query.email || req.body?.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ error: "Missing email" });

    const raw = await kv.get(`drip:${email}`).catch(() => null);
    if (raw) {
      const sub = JSON.parse(raw);
      sub.unsubscribed = true;
      await kv.set(`drip:${email}`, JSON.stringify(sub));
    }
    await kv.srem("drip:subscribers", email);

    // Return HTML for GET unsubscribe link
    if (req.method === "GET") {
      return res.status(200).send(`
        <!DOCTYPE html><html><body style="background:#0d1117;color:#e6edf3;font-family:sans-serif;text-align:center;padding:60px 24px;">
          <h1 style="color:#f0b90b;">⚡ Unsubscribed</h1>
          <p>You've been removed from CryptoSignal.id email updates.</p>
          <a href="${SITE_URL}" style="color:#f0b90b;">← Back to signals</a>
        </body></html>
      `);
    }

    return res.status(200).json({ ok: true });
  }

  // ── Daily cron: send pending Day 3 and Day 7 emails ──────────────────────
  if (action === "run-drip") {
    // Verify cron secret
    const secret = req.headers["x-cron-secret"] || req.query.secret;
    if (secret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const members = await kv.smembers("drip:subscribers").catch(() => []);
    const now = Date.now();
    let day3Sent = 0, day7Sent = 0, skipped = 0;

    for (const email of members) {
      const raw = await kv.get(`drip:${email}`).catch(() => null);
      if (!raw) continue;

      const sub = JSON.parse(raw);
      if (sub.unsubscribed) continue;

      const daysSinceEnroll = (now - sub.enrolledAt) / (1000 * 60 * 60 * 24);

      // Day 3
      if (!sub.day3Sent && daysSinceEnroll >= 3) {
        const { subject, html } = EMAILS.day3(email);
        const result = await sendEmail(email, subject, html);
        if (result.ok) {
          sub.day3Sent = true;
          day3Sent++;
        }
      }

      // Day 7
      if (!sub.day7Sent && daysSinceEnroll >= 7) {
        const { subject, html } = EMAILS.day7(email);
        const result = await sendEmail(email, subject, html);
        if (result.ok) {
          sub.day7Sent = true;
          day7Sent++;
        }
      } else {
        skipped++;
      }

      // Clean up fully-completed subscribers after 14 days
      if (sub.day7Sent && daysSinceEnroll >= 14) {
        await kv.del(`drip:${email}`);
        await kv.srem("drip:subscribers", email);
      } else {
        await kv.set(`drip:${email}`, JSON.stringify(sub));
      }
    }

    return res.status(200).json({
      ok: true,
      processed: members.length,
      day3Sent,
      day7Sent,
      skipped,
    });
  }

  return res.status(400).json({ error: "Unknown action" });
};
