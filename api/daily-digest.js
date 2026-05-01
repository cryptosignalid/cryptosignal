// api/daily-digest.js
// Generates daily market digest and sends to owner + all Pro subscribers
// Triggered by Vercel Cron: runs every day at 08:00 WIB (01:00 UTC)

const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID; // Your personal Telegram chat ID
const CG_KEY = process.env.CG_KEY || 'CG-LUGa4vpkw7FgUiQ3wyGWaeVp';
const GNEWS_KEY = process.env.GNEWS_KEY || '204f00771794b2f674c4f2e4a924623d';
const BROADCAST_KEY = process.env.BROADCAST_SECRET || 'cs-broadcast-secret';
const SITE_URL = process.env.SITE_URL || 'https://cryptosignal.id';

// ── Fetch market data ──
async function getMarketData() {
  try {
    const [pricesRes, globalRes, fngRes, trendingRes] = await Promise.allSettled([
      fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,ripple&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&x_cg_demo_api_key=${CG_KEY}`),
      fetch(`https://api.coingecko.com/api/v3/global?x_cg_demo_api_key=${CG_KEY}`),
      fetch('https://api.alternative.me/fng/?limit=3&format=json'),
      fetch(`https://api.coingecko.com/api/v3/search/trending?x_cg_demo_api_key=${CG_KEY}`),
    ]);

    const prices = pricesRes.status === 'fulfilled' && pricesRes.value.ok
      ? await pricesRes.value.json() : {};
    const global = globalRes.status === 'fulfilled' && globalRes.value.ok
      ? (await globalRes.value.json()).data : {};
    const fng = fngRes.status === 'fulfilled' && fngRes.value.ok
      ? (await fngRes.value.json()).data : [];
    const trending = trendingRes.status === 'fulfilled' && trendingRes.value.ok
      ? (await trendingRes.value.json()).coins?.slice(0, 3).map(c => c.item) : [];

    return { prices, global, fng, trending };
  } catch (e) {
    console.error('Market data error:', e.message);
    return { prices: {}, global: {}, fng: [], trending: [] };
  }
}

// ── Fetch top news ──
async function getTopNews() {
  try {
    const r = await fetch(
      `https://gnews.io/api/v4/search?q=bitcoin+crypto&lang=en&max=5&sortby=publishedAt&apikey=${GNEWS_KEY}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.articles || []).slice(0, 3);
  } catch (e) { return []; }
}

// ── Format numbers ──
const fmtUSD = n => n >= 1000 ? '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '$' + n.toFixed(2);
const fmtPct = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const fmtCap = n => n >= 1e12 ? '$' + (n / 1e12).toFixed(2) + 'T' : '$' + (n / 1e9).toFixed(1) + 'B';

// ── Build Telegram message ──
function buildTelegramMessage({ prices, global, fng, trending, news, date }) {
  const btc = prices.bitcoin || {};
  const eth = prices.ethereum || {};
  const sol = prices.solana || {};
  const bnb = prices.binancecoin || {};
  const xrp = prices.ripple || {};

  const fngToday = fng[0] || {};
  const fngYest  = fng[1] || {};
  const fngScore = parseInt(fngToday.value || 50);
  const fngLabel = fngToday.value_classification || 'Neutral';
  const fngEmoji = fngScore <= 20 ? '😱' : fngScore <= 40 ? '😨' : fngScore <= 60 ? '😐' : fngScore <= 80 ? '😏' : '🤑';
  const fngChange = fng.length > 1 ? fngScore - parseInt(fngYest.value || fngScore) : 0;
  const fngArrow = fngChange > 0 ? '↑' : fngChange < 0 ? '↓' : '→';

  const capChg = global.market_cap_change_percentage_24h_usd || 0;
  const btcDom = global.market_cap_percentage?.btc || 0;
  const totalCap = fmtCap(global.total_market_cap?.usd || 0);

  const marketMood = fngScore <= 30 ? 'FEAR ZONE 🔴' : fngScore >= 70 ? 'GREED ZONE 🟢' : 'NEUTRAL ZONE ⚪';

  const trendStr = trending.length
    ? trending.map((t, i) => `${i + 1}. ${t.name} (${t.symbol?.toUpperCase()})`).join('\n')
    : 'N/A';

  const newsStr = news.length
    ? news.map((n, i) => `${i + 1}. ${n.title?.substring(0, 80)}${n.title?.length > 80 ? '…' : ''}`).join('\n')
    : 'No major news';

  // Social media ready copy for TikTok/IG/Twitter
  const socialCopy = buildSocialCopy({ btc, fngScore, fngLabel, capChg, trending, marketMood });

  return `
━━━━━━━━━━━━━━━━━━━━━
⚡ *CRYPTOSIGNAL DAILY BRIEF*
📅 ${date} • WIB Morning Edition
━━━━━━━━━━━━━━━━━━━━━

📊 *MARKET OVERVIEW*
Total Cap: *${totalCap}* (${fmtPct(capChg)} 24h)
BTC Dominance: *${btcDom.toFixed(1)}%*
Mood: *${marketMood}*

💰 *PRICE SNAPSHOT*
₿ BTC  ${btc.usd ? fmtUSD(btc.usd) : '—'}  ${btc.usd_24h_change ? fmtPct(btc.usd_24h_change) : ''}
Ξ ETH  ${eth.usd ? fmtUSD(eth.usd) : '—'}  ${eth.usd_24h_change ? fmtPct(eth.usd_24h_change) : ''}
◎ SOL  ${sol.usd ? fmtUSD(sol.usd) : '—'}  ${sol.usd_24h_change ? fmtPct(sol.usd_24h_change) : ''}
◈ BNB  ${bnb.usd ? fmtUSD(bnb.usd) : '—'}  ${bnb.usd_24h_change ? fmtPct(bnb.usd_24h_change) : ''}
✦ XRP  ${xrp.usd ? fmtUSD(xrp.usd) : '—'}  ${xrp.usd_24h_change ? fmtPct(xrp.usd_24h_change) : ''}

${fngEmoji} *FEAR & GREED: ${fngScore}/100 — ${fngLabel}*
${fngArrow} Changed ${Math.abs(fngChange)} pts from yesterday
${getFngInsight(fngScore)}

🔥 *TRENDING COINS TODAY*
${trendStr}

📰 *TOP SIGNALS*
${newsStr}

━━━━━━━━━━━━━━━━━━━━━
📱 *READY TO POST — COPY BELOW*
━━━━━━━━━━━━━━━━━━━━━

${socialCopy}

━━━━━━━━━━━━━━━━━━━━━
🔗 Full signals: ${SITE_URL}
⚡ CryptoSignal Pro — Real-time AI Market Intelligence
`.trim();
}

function getFngInsight(score) {
  if (score <= 20) return '📌 *Extreme Fear* — Historically a strong buy signal. Blood in the streets.';
  if (score <= 35) return '📌 *Fear* — Market oversold. Watch for reversal signals.';
  if (score <= 50) return '📌 *Neutral* — No strong directional bias. Wait for confirmation.';
  if (score <= 65) return '📌 *Greed* — Momentum building. Manage risk carefully.';
  if (score <= 80) return '📌 *High Greed* — Market overheated. Consider taking profits.';
  return '📌 *Extreme Greed* — Peak euphoria. High correction risk.';
}

// Build ready-to-post social media copy
function buildSocialCopy({ btc, fngScore, fngLabel, capChg, trending, marketMood }) {
  const btcPrice = btc.usd ? fmtUSD(btc.usd) : '—';
  const btcChg = btc.usd_24h_change ? fmtPct(btc.usd_24h_change) : '';
  const trend1 = trending[0]?.symbol?.toUpperCase() || 'CRYPTO';
  const mood = fngScore <= 40 ? 'FEAR' : fngScore >= 60 ? 'GREED' : 'NEUTRAL';

  // Instagram/TikTok caption
  const igCaption = `🚨 CRYPTO DAILY UPDATE ${new Date().toLocaleDateString('en-GB')}

💰 BTC: ${btcPrice} (${btcChg})
😱 Fear & Greed: ${fngScore}/100 — ${fngLabel}
📊 Market: ${capChg >= 0 ? '🟢' : '🔴'} ${Math.abs(capChg).toFixed(1)}% 24h
🔥 Trending: #${trend1}

${fngScore <= 35 ? '🎯 Fear zone = opportunity for smart money' : fngScore >= 65 ? '⚠️ Greed zone = be careful, take profits' : '⏳ Neutral zone = wait for clear direction'}

Follow for daily crypto signals 👆
📲 cryptosignal.id for live feed

#crypto #bitcoin #ethereum #cryptoIndonesia #bitcoinindonesia #kripto #investasi #altcoin #${trend1.toLowerCase()} #cryptosignals`;

  // Twitter/X thread
  const twitterPost = `🧵 CRYPTO MORNING BRIEF ${new Date().toLocaleDateString('en-GB')}

BTC ${btcPrice} ${btcChg}
Fear & Greed: ${fngScore} (${fngLabel})
Trending: $${trend1}

${fngScore <= 35 ? 'Fear = buying opportunity historically' : fngScore >= 65 ? 'Greed zone — manage risk' : 'Neutral — wait for direction'}

Live signals → cryptosignal.id 🔗

#Bitcoin #Crypto #CryptoSignal`;

  return `*📱 INSTAGRAM/TIKTOK CAPTION:*\n\`\`\`\n${igCaption}\n\`\`\`\n\n*🐦 TWITTER/X POST:*\n\`\`\`\n${twitterPost}\n\`\`\``;
}

// ── Send Telegram message ──
async function tgSend(chatId, text) {
  if (!chatId || !TG_BOT_TOKEN) return false;
  // Split if > 4000 chars (TG limit)
  const chunks = [];
  for (let i = 0; i < text.length; i += 3900) chunks.push(text.slice(i, i + 3900));
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: 'Markdown' }),
    }).catch(e => console.error('TG error:', e.message));
  }
  return true;
}

// ── Main handler ──
export default async function handler(req, res) {
  // Allow manual trigger via GET with secret, or Vercel Cron
  const cronSecret = req.headers['x-vercel-cron-secret'] || req.query.secret;
  const manualSecret = process.env.CRON_SECRET || 'cs-cron-secret';

  if (req.method === 'GET' && req.query.secret !== manualSecret && !req.headers['x-vercel-cron-secret']) {
    return res.status(401).json({ message: 'Unauthorized — add ?secret=YOUR_CRON_SECRET' });
  }

  try {
    console.log('Daily digest starting...');

    const now = new Date();
    const date = now.toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      timeZone: 'Asia/Jakarta'
    });

    const [{ prices, global, fng, trending }, news] = await Promise.all([
      getMarketData(),
      getTopNews(),
    ]);

    const message = buildTelegramMessage({ prices, global, fng, trending, news, date });

    // 1. Send to owner first
    if (OWNER_CHAT_ID) {
      await tgSend(OWNER_CHAT_ID, message);
      console.log('Sent to owner:', OWNER_CHAT_ID);
    }

    // 2. Broadcast to all Pro subscribers
    const broadcastRes = await fetch(`${SITE_URL}/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-broadcast-key': BROADCAST_KEY },
      body: JSON.stringify({
        message,
        articleTitle: `Daily Crypto Brief — ${date}`,
        signalType: 'neutral',
        impact: 60,
        source: 'CryptoSignal Daily',
      }),
    }).catch(e => ({ ok: false, error: e.message }));

    const broadcastData = broadcastRes.json ? await broadcastRes.json().catch(() => ({})) : {};
    console.log('Broadcast result:', broadcastData);

    return res.status(200).json({
      ok: true,
      date,
      sent_to_owner: !!OWNER_CHAT_ID,
      broadcast: broadcastData,
      message_length: message.length,
    });

  } catch (err) {
    console.error('Daily digest error:', err.message, err.stack);
    return res.status(500).json({ message: err.message });
  }
}
