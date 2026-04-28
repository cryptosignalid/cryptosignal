/**
 * Agent 2 — GNews Server-Side Proxy
 * Moves GNEWS_KEY from client-side JS to secure server env var.
 * 
 * GET /api/gnews?q=bitcoin&max=10&lang=en&country=id
 * 
 * Security: Rate limited per IP (20 req/min). Validates query params.
 * Caches responses in KV for 3 minutes to protect against client hammering.
 */

const { createClient } = require("@vercel/kv");

const CACHE_TTL = 180; // 3 minutes
const RATE_LIMIT_WINDOW = 60; // 1 minute
const RATE_LIMIT_MAX = 20;

// Allowed query topics to prevent abuse
const ALLOWED_QUERIES = [
  // CryptoSignal.id approved queries only
  "bitcoin ethereum crypto market",
  "cryptocurrency regulation blockchain",
  "crypto altcoin defi nft",
  // Fallback single-coin queries
  "bitcoin",
  "ethereum",
  "bnb binance",
  "solana",
  "xrp ripple",
  "crypto indonesia",
];

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  // CORS
  res.setHeader("Access-Control-Allow-Origin", process.env.SITE_URL || "https://cryptosignal.id");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const { q, max = "10", lang = "en", country = "any" } = req.query;

  if (!q) {
    return res.status(400).json({ error: "Missing query param: q" });
  }

  // Validate query is an approved topic (prevent key abuse)
  const isAllowed = ALLOWED_QUERIES.some(
    allowed => q.toLowerCase().includes(allowed.split(" ")[0])
  );
  if (!isAllowed) {
    return res.status(403).json({ error: "Query not permitted" });
  }

  // Validate max
  const maxInt = Math.min(parseInt(max, 10) || 10, 10);

  const kv = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  // Rate limit by IP
  const ip = getClientIP(req);
  const rateLimitKey = `rl:gnews:${ip}:${Math.floor(Date.now() / (RATE_LIMIT_WINDOW * 1000))}`;
  const currentCount = await kv.incr(rateLimitKey);
  if (currentCount === 1) {
    await kv.expire(rateLimitKey, RATE_LIMIT_WINDOW);
  }
  if (currentCount > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      retry_after: RATE_LIMIT_WINDOW,
    });
  }

  // Check cache
  const cacheKey = `gnews:cache:${q}:${lang}:${country}:${maxInt}`;
  const cached = await kv.get(cacheKey);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    res.setHeader("Cache-Control", `public, max-age=${CACHE_TTL}`);
    return res.status(200).json(cached);
  }

  // Fetch from GNews
  const apiKey = process.env.GNEWS_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "GNews not configured" });
  }

  const params = new URLSearchParams({
    q,
    max: maxInt,
    lang,
    country,
    sortby: "publishedAt",
    token: apiKey,
  });

  try {
    const upstream = await fetch(
      `https://gnews.io/api/v4/search?${params.toString()}`
    );

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error(`GNews upstream error ${upstream.status}:`, errText);
      return res.status(upstream.status).json({
        error: "GNews upstream error",
        status: upstream.status,
      });
    }

    const data = await upstream.json();

    // Cache successful response
    await kv.set(cacheKey, data, { ex: CACHE_TTL });

    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", `public, max-age=${CACHE_TTL}`);
    return res.status(200).json(data);
  } catch (err) {
    console.error("GNews fetch error:", err);
    return res.status(502).json({ error: "Failed to fetch from GNews" });
  }
};
