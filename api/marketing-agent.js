// api/marketing-agent.js
// Agent 4 — Daily Social Media Signal Post Generator
// Runs via Vercel Cron: 0 9 * * * (9am Jakarta time = 02:00 UTC)
// Generates top 3 signals → formats for TikTok/IG/YouTube → queues for posting

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHANNEL = process.env.TG_CHANNEL_ID || '@cryptosignal_id';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN;
const BUFFER_PROFILE_IDS = (process.env.BUFFER_PROFILE_IDS || '').split(',');

// ── Generate daily signal summary via Claude API ──
async function generateDailySummary(signals) {
  if (!ANTHROPIC_KEY) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `You are a crypto market analyst for Indonesian traders. 
          
Here are today's top 3 crypto signals from CryptoSignal.id:

${signals.map((s, i) => `${i+1}. [${s.type.toUpperCase()}] ${s.title} (Impact: ${s.impact}/100, Trust: ${s.trust})`).join('\n')}

Generate a TikTok/Instagram caption in this format:
- Line 1: 🚨 Hook headline (max 10 words, use emojis, Indonesian OK)
- Line 2-4: 3 bullet points, one per signal
- Line 5: CTA mentioning cryptosignal.id
- Hashtags: 10 relevant crypto + Indonesia hashtags

Keep it punchy, market-focused, and professional. No financial advice disclaimer needed.`
        }],
      }),
    });
    const d = await r.json();
    return d.content?.[0]?.text || null;
  } catch { return null; }
}

// ── Post to Telegram channel ──
async function postToTelegram(text) {
  if (!TG_BOT_TOKEN) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHANNEL,
        text: `📡 *DAILY CRYPTO SIGNAL DIGEST*\n\n${text}\n\n_cryptosignal.id — Real-time AI crypto intelligence_`,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    });
    return (await r.json()).ok;
  } catch { return false; }
}

// ── Queue to Buffer for IG/TikTok/Twitter ──
async function queueToBuffer(text, profileIds) {
  if (!BUFFER_TOKEN || !profileIds.length) return false;
  const results = await Promise.allSettled(profileIds.map(profileId =>
    fetch('https://api.bufferapp.com/1/updates/create.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        access_token: BUFFER_TOKEN,
        profile_ids: [profileId],
        text: text,
        now: 'false', // queue at best time
      }),
    }).then(r => r.json())
  ));
  return results.some(r => r.status === 'fulfilled');
}

// ── Fetch top signals from our own feed ──
async function fetchTopSignals() {
  // Fetch from CoinGecko + GNews — same sources as main app
  const signals = [];

  // Fear & Greed
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=1&format=json');
    const d = await r.json();
    const fng = d.data?.[0];
    if (fng) signals.push({
      type: parseInt(fng.value) < 40 ? 'bear' : parseInt(fng.value) > 70 ? 'bull' : 'neutral',
      title: `Fear & Greed Index: ${fng.value_classification} at ${fng.value}/100`,
      impact: 80, trust: 9.0,
    });
  } catch {}

  // CoinGecko trending
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/search/trending');
    const d = await r.json();
    const top = d.coins?.[0]?.item;
    if (top) signals.push({
      type: 'bull',
      title: `${top.name} (${top.symbol}) is #1 trending on CoinGecko`,
      impact: 75, trust: 9.0,
    });
  } catch {}

  // BTC price movement
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true');
    const d = await r.json();
    const btcChg = d.bitcoin?.usd_24h_change || 0;
    signals.push({
      type: Math.abs(btcChg) > 3 ? (btcChg > 0 ? 'bull' : 'bear') : 'neutral',
      title: `BTC $${d.bitcoin?.usd?.toLocaleString()} (${btcChg > 0 ? '+' : ''}${btcChg.toFixed(1)}% 24h) · ETH $${d.ethereum?.usd?.toLocaleString()}`,
      impact: Math.min(95, 50 + Math.abs(btcChg) * 5), trust: 9.5,
    });
  } catch {}

  return signals.slice(0, 3);
}

export default async function handler(req, res) {
  // Verify cron secret (Vercel sends this header)
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const signals = await fetchTopSignals();
    if (!signals.length) return res.json({ ok: false, message: 'No signals fetched' });

    const caption = await generateDailySummary(signals) || signals.map((s, i) =>
      `${i + 1}. ${s.type === 'bull' ? '📈' : s.type === 'bear' ? '📉' : '⚡'} ${s.title}`
    ).join('\n');

    const fullPost = `${caption}\n\n🔔 Get instant alerts: cryptosignal.id/pro`;

    const [tgOk, bufferOk] = await Promise.all([
      postToTelegram(fullPost),
      queueToBuffer(fullPost, BUFFER_PROFILE_IDS),
    ]);

    console.log('Marketing agent ran:', { tgOk, bufferOk, signalCount: signals.length });
    return res.json({ ok: true, tgOk, bufferOk, signalCount: signals.length });
  } catch (err) {
    console.error('Marketing agent error:', err.message);
    return res.status(500).json({ message: err.message });
  }
}
