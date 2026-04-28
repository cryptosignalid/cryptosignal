/**
 * Agent 2 — Analytics API
 * Anonymous event tracking: pageview, signal_click, paywall_hit, email_capture, upgrade
 * Stores to Vercel KV (Redis). Zero PII collected.
 * GET  ?action=stats           → aggregate dashboard (for internal use)
 * POST { event, meta }         → record event
 */

const { createClient } = require("@vercel/kv");

const ALLOWED_EVENTS = [
  "pageview",
  "signal_click",
  "paywall_hit",
  "email_capture",
  "upgrade_click",
  "upgrade_success",
  "alert_created",
  "referral_click",
  "affiliate_click",
  "search",
  "filter_change",
];

// TTL for daily buckets: 90 days
const TTL_90D = 60 * 60 * 24 * 90;

function getTodayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-04-28"
}

function getCORSHeaders() {
  return {
    "Access-Control-Allow-Origin": process.env.SITE_URL || "https://cryptosignal.id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

module.exports = async function handler(req, res) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).set(getCORSHeaders()).end();
  }

  Object.entries(getCORSHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  // ── GET /api/analytics?action=stats ──────────────────────────────────────
  if (req.method === "GET") {
    const { action, days = "7" } = req.query;

    // Simple auth: require internal secret
    const secret = req.headers["x-analytics-secret"];
    if (secret !== process.env.ANALYTICS_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (action === "stats") {
      const numDays = Math.min(parseInt(days, 10) || 7, 90);
      const results = {};

      for (let i = 0; i < numDays; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().slice(0, 10);

        const dayStats = {};
        for (const evt of ALLOWED_EVENTS) {
          const count = await kv.get(`analytics:${dateKey}:${evt}`);
          if (count) dayStats[evt] = parseInt(count, 10);
        }
        results[dateKey] = dayStats;
      }

      // Totals
      const totals = {};
      for (const day of Object.values(results)) {
        for (const [evt, count] of Object.entries(day)) {
          totals[evt] = (totals[evt] || 0) + count;
        }
      }

      return res.status(200).json({
        ok: true,
        period: `${numDays}d`,
        totals,
        daily: results,
      });
    }

    // Funnel: paywall_hit → email_capture → upgrade conversion rate
    if (action === "funnel") {
      const today = getTodayKey();
      const [paywall, email, upgrade] = await Promise.all([
        kv.get(`analytics:${today}:paywall_hit`),
        kv.get(`analytics:${today}:email_capture`),
        kv.get(`analytics:${today}:upgrade_success`),
      ]);

      const p = parseInt(paywall, 10) || 0;
      const e = parseInt(email, 10) || 0;
      const u = parseInt(upgrade, 10) || 0;

      return res.status(200).json({
        ok: true,
        date: today,
        funnel: {
          paywall_hit: p,
          email_capture: e,
          upgrade_success: u,
          email_capture_rate: p > 0 ? `${((e / p) * 100).toFixed(1)}%` : "0%",
          upgrade_rate: e > 0 ? `${((u / e) * 100).toFixed(1)}%` : "0%",
          overall_conversion: p > 0 ? `${((u / p) * 100).toFixed(1)}%` : "0%",
        },
      });
    }

    return res.status(400).json({ error: "Unknown action" });
  }

  // ── POST /api/analytics ──────────────────────────────────────────────────
  if (req.method === "POST") {
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const { event, meta = {} } = body || {};

    if (!event || !ALLOWED_EVENTS.includes(event)) {
      return res.status(400).json({ error: "Invalid event", allowed: ALLOWED_EVENTS });
    }

    const dateKey = getTodayKey();
    const kvKey = `analytics:${dateKey}:${event}`;

    // Atomic increment
    await kv.incr(kvKey);
    await kv.expire(kvKey, TTL_90D);

    // Store meta snapshot for signal_click (which coin, what trust score)
    if (event === "signal_click" && meta.coin) {
      const coinKey = `analytics:coins:${dateKey}:${meta.coin.toUpperCase()}`;
      await kv.incr(coinKey);
      await kv.expire(coinKey, TTL_90D);
    }

    // Track affiliate link clicks per exchange
    if (event === "affiliate_click" && meta.exchange) {
      const affKey = `analytics:affiliate:${dateKey}:${meta.exchange}`;
      await kv.incr(affKey);
      await kv.expire(affKey, TTL_90D);
    }

    return res.status(200).json({ ok: true, event, date: dateKey });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
