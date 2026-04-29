// api/marketing-agent.js
// Daily content pack — text + HTML image card + TikTok script + YouTube instructions
// Runs 9am WIB via Vercel cron

const TG_BOT_TOKEN  = process.env.TG_BOT_TOKEN || '8731034518:AAHTpe89-toSMtlV5N_gYu__Zy5-EVUU8tA';
const TG_CHANNEL    = process.env.TG_CHANNEL_ID || '@cryptosignal_id';
const ADMIN_CHAT    = process.env.TG_ADMIN_CHAT_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const SITE_URL      = process.env.SITE_URL || 'https://cryptosignal.id';

async function getMarketData() {
  try {
    // Try CoinGecko first
    const [fgRes, cgRes] = await Promise.all([
      fetch('https://api.alternative.me/fng/?limit=1', { headers: { 'Accept': 'application/json' } }),
      fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=5&sparkline=false', { headers: { 'Accept': 'application/json' } }),
    ]);

    if (!fgRes.ok || !cgRes.ok) {
      console.error('API error - FG:', fgRes.status, 'CG:', cgRes.status);
    }

    const fg = fgRes.ok ? await fgRes.json() : null;
    const cg = cgRes.ok ? await cgRes.json() : null;

    if (!cg || !Array.isArray(cg) || cg.length === 0) {
      console.error('CoinGecko returned no data');
      return null;
    }

    return {
      fearGreed: fg?.data?.[0] || { value: '50', value_classification: 'Neutral' },
      coins: cg.map(c => ({
        symbol: c.symbol.toUpperCase(),
        price: c.current_price,
        change24h: (+c.price_change_percentage_24h).toFixed(2),
      })),
    };
  } catch(e) {
    console.error('getMarketData error:', e.message);
    return null;
  }
}

async function generateContent(market) {
  const btc = market?.coins?.find(c => c.symbol === 'BTC');
  const eth = market?.coins?.find(c => c.symbol === 'ETH');
  const sol = market?.coins?.find(c => c.symbol === 'SOL');
  const fg  = market?.fearGreed;

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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Crypto market data:
Fear & Greed: ${fg?.value}/100 (${fg?.value_classification})
BTC: $${btc?.price?.toLocaleString()} (${btc?.change24h}% 24h)
ETH: $${eth?.price?.toLocaleString()} (${eth?.change24h}% 24h)
SOL: $${sol?.price?.toLocaleString()} (${sol?.change24h}% 24h)

Return ONLY raw JSON no backticks:
{
  "headline": "5-7 word punchy headline about today's market in ENGLISH ALL CAPS",
  "subheadline": "One line market insight in Indonesian",
  "market_mood": "one word: FEARFUL or NEUTRAL or GREEDY",
  "telegram_channel": "Markdown post *bold* max 250 chars, F&G + prices, end: 📡 cryptosignal.id",
  "twitter": "max 230 chars, punchy alpha, BTC price + F&G insight, end: cryptosignal.id | @signalcrypto_id",
  "instagram_caption": "hook emoji line 1\\nline 2 market insight Indonesian\\nline 3 CTA\\n\\n#cryptosignal #kripto #bitcoin #ethereum #tradingcrypto #cryptoindonesia #btc #investasi #altcoin #blockchain #sinyal #trader",
  "tiktok_hook": "3 words MAX all caps for text overlay hook",
  "tiktok_bullet1": "short punchy point about market in Indonesian",
  "tiktok_bullet2": "short punchy point about opportunity",
  "tiktok_bullet3": "short punchy CTA point",
  "youtube_title": "Community post title max 60 chars",
  "youtube_body": "2-3 sentences Indonesian market analysis with question at end to drive comments"
}`
        }],
      }),
    });
    const d = await r.json();
    const text = (d.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch(e) {
    console.error('Claude error:', e.message);
    return null;
  }
}

// Build IG image HTML — dark crypto aesthetic, 1080x1080
function buildIGCard(content, market) {
  const btc = market?.coins?.find(c => c.symbol === 'BTC');
  const eth = market?.coins?.find(c => c.symbol === 'ETH');
  const sol = market?.coins?.find(c => c.symbol === 'SOL');
  const fg  = market?.fearGreed;
  const fgColor = fg?.value < 25 ? '#ff4444' : fg?.value < 45 ? '#ff8800' : fg?.value < 55 ? '#ffcc00' : fg?.value < 75 ? '#88cc00' : '#00cc66';
  const btcColor = btc?.change24h >= 0 ? '#00d4aa' : '#ff4466';
  const ethColor = eth?.change24h >= 0 ? '#00d4aa' : '#ff4466';
  const solColor = sol?.change24h >= 0 ? '#00d4aa' : '#ff4466';
  const headline = content?.headline || 'MARKET UPDATE TODAY';
  const subheadline = content?.subheadline || 'Pantau sinyal live di cryptosignal.id';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width: 1080px; height: 1080px; overflow: hidden;
    background: #040610;
    font-family: 'Inter', sans-serif;
    position: relative;
  }
  /* Background grid */
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px);
    background-size: 54px 54px;
  }
  /* Glow orbs */
  .orb1 {
    position:absolute; width:600px; height:600px; border-radius:50%;
    background: radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%);
    top:-200px; right:-200px;
  }
  .orb2 {
    position:absolute; width:400px; height:400px; border-radius:50%;
    background: radial-gradient(circle, rgba(240,185,11,0.08) 0%, transparent 70%);
    bottom:-100px; left:-100px;
  }
  .container {
    position: relative; z-index: 2;
    width: 100%; height: 100%;
    padding: 64px;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  /* Top bar */
  .topbar {
    display: flex; align-items: center; justify-content: space-between;
  }
  .logo {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 32px; letter-spacing: 3px;
    color: #f0b90b;
  }
  .logo span { color: #00d4ff; }
  .date-badge {
    font-family: 'Space Mono', monospace;
    font-size: 13px; color: #5a6a8a;
    border: 1px solid #1e2a3a;
    padding: 6px 14px; border-radius: 20px;
  }
  /* Headline */
  .headline-section { text-align: center; padding: 20px 0; }
  .headline {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 108px; line-height: 0.9;
    background: linear-gradient(135deg, #ffffff 30%, #00d4ff 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    letter-spacing: 2px;
  }
  .subheadline {
    font-size: 22px; color: #8899bb;
    margin-top: 16px; font-weight: 400;
  }
  /* Fear & Greed */
  .fg-bar {
    background: #0a0f1e;
    border: 1px solid #1e2a3a;
    border-radius: 16px; padding: 24px 32px;
    display: flex; align-items: center; gap: 24px;
  }
  .fg-label { font-size: 13px; color: #5a6a8a; text-transform: uppercase; letter-spacing: 2px; }
  .fg-value {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 56px; color: ${fgColor}; line-height: 1;
  }
  .fg-text { font-size: 18px; color: ${fgColor}; font-weight: 600; }
  .fg-track {
    flex: 1; height: 8px;
    background: #1e2a3a; border-radius: 4px; overflow: hidden;
  }
  .fg-fill {
    height: 100%; width: ${fg?.value || 50}%;
    background: linear-gradient(90deg, #ff4444, #ff8800, #ffcc00, #88cc00, #00cc66);
    border-radius: 4px;
  }
  /* Price grid */
  .prices {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
  }
  .price-card {
    background: #0a0f1e;
    border: 1px solid #1e2a3a;
    border-radius: 12px; padding: 20px 24px;
  }
  .price-symbol {
    font-family: 'Space Mono', monospace;
    font-size: 14px; color: #5a6a8a;
    margin-bottom: 8px;
  }
  .price-value {
    font-size: 26px; font-weight: 800; color: #e6edf3;
    margin-bottom: 4px;
  }
  .price-change {
    font-family: 'Space Mono', monospace;
    font-size: 14px; font-weight: 700;
  }
  .up { color: #00d4aa; }
  .down { color: #ff4466; }
  /* Bottom */
  .bottom {
    display: flex; align-items: center; justify-content: space-between;
  }
  .signal-badge {
    background: linear-gradient(135deg, #f0b90b22, #f0b90b11);
    border: 1px solid #f0b90b44;
    border-radius: 12px; padding: 12px 24px;
    font-size: 16px; color: #f0b90b; font-weight: 600;
  }
  .url {
    font-family: 'Space Mono', monospace;
    font-size: 16px; color: #2a3a5a;
  }
  .live-dot {
    display: inline-block; width: 8px; height: 8px;
    background: #00d4aa; border-radius: 50%;
    margin-right: 8px; animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%,100% { opacity:1; } 50% { opacity:0.3; }
  }
</style>
</head>
<body>
<div class="grid"></div>
<div class="orb1"></div>
<div class="orb2"></div>
<div class="container">

  <div class="topbar">
    <div class="logo">CRYPTO<span>SIGNAL</span>.ID</div>
    <div class="date-badge">${new Date().toLocaleDateString('en-US', { weekday:'short', day:'numeric', month:'short', year:'numeric' })}</div>
  </div>

  <div class="headline-section">
    <div class="headline">${headline}</div>
    <div class="subheadline">${subheadline}</div>
  </div>

  <div class="fg-bar">
    <div>
      <div class="fg-label">Fear & Greed Index</div>
      <div class="fg-value">${fg?.value || '–'}</div>
      <div class="fg-text">${fg?.value_classification || '–'}</div>
    </div>
    <div class="fg-track">
      <div class="fg-fill"></div>
    </div>
  </div>

  <div class="prices">
    <div class="price-card">
      <div class="price-symbol">₿ BITCOIN</div>
      <div class="price-value">$${btc?.price?.toLocaleString()}</div>
      <div class="price-change ${btc?.change24h >= 0 ? 'up' : 'down'}">${btc?.change24h >= 0 ? '▲' : '▼'} ${Math.abs(btc?.change24h)}% 24h</div>
    </div>
    <div class="price-card">
      <div class="price-symbol">Ξ ETHEREUM</div>
      <div class="price-value">$${eth?.price?.toLocaleString()}</div>
      <div class="price-change ${eth?.change24h >= 0 ? 'up' : 'down'}">${eth?.change24h >= 0 ? '▲' : '▼'} ${Math.abs(eth?.change24h)}% 24h</div>
    </div>
    <div class="price-card">
      <div class="price-symbol">◎ SOLANA</div>
      <div class="price-value">$${sol?.price?.toLocaleString()}</div>
      <div class="price-change ${sol?.change24h >= 0 ? 'up' : 'down'}">${sol?.change24h >= 0 ? '▲' : '▼'} ${Math.abs(sol?.change24h)}% 24h</div>
    </div>
  </div>

  <div class="bottom">
    <div class="signal-badge">⚡ ${market?.coins?.filter(c => c.change24h >= 0).length || 0} BULLISH SIGNALS TODAY</div>
    <div class="url"><span class="live-dot"></span>cryptosignal.id</div>
  </div>

</div>
</body>
</html>`;
}

async function tgSend(chatId, text, extra = {}) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', ...extra }),
    });
    return (await r.json()).ok;
  } catch(e) { return false; }
}

module.exports = async function handler(req, res) {
  // Serve IG card as HTML page
  if (req.method === 'GET' && req.query.action === 'ig-card') {
    let market = await getMarketData();
    // Fallback data if API fails
    if (!market || !market.coins?.length) {
      market = {
        fearGreed: { value: '–', value_classification: 'Loading...' },
        coins: [
          { symbol: 'BTC', price: 0, change24h: '0.00' },
          { symbol: 'ETH', price: 0, change24h: '0.00' },
          { symbol: 'SOL', price: 0, change24h: '0.00' },
        ],
      };
    }
    let content = await generateContent(market);
    if (!content) {
      content = {
        headline: 'LIVE CRYPTO SIGNALS',
        subheadline: 'Pantau sinyal real-time di cryptosignal.id',
      };
    }
    const html = buildIGCard(content, market);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  }

  const secret = req.headers['x-vercel-cron-secret'] ||
                 req.query.secret ||
                 req.headers['authorization']?.replace('Bearer ', '');

  if (secret !== process.env.CRON_SECRET && req.headers['x-vercel-cron'] !== '1') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('🚀 Marketing agent:', new Date().toISOString());

  try {
    const market  = await getMarketData();
    const content = await generateContent(market);
    const btc = market?.coins?.find(c => c.symbol === 'BTC');
    const fg  = market?.fearGreed;
    const date = new Date().toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta', weekday:'long', day:'numeric', month:'long', year:'numeric'
    });

    // 1. Post to Telegram channel
    const tgOk = await tgSend(TG_CHANNEL, content?.telegram_channel || `⚡ *CryptoSignal Daily*\n\nBTC: *$${btc?.price?.toLocaleString()}* (${btc?.change24h}%)\nF&G: *${fg?.value}/100*\n\n📡 cryptosignal.id`);

    // 2. Send content pack to admin
    if (ADMIN_CHAT) {
      await tgSend(ADMIN_CHAT, `📊 *CryptoSignal Daily Pack*\n${date}\n\n₿ BTC: $${btc?.price?.toLocaleString()} (${btc?.change24h}%)\n🧠 F&G: ${fg?.value}/100 (${fg?.value_classification})\n\n✅ Telegram channel: POSTED AUTO`);
      await new Promise(r => setTimeout(r, 400));

      await tgSend(ADMIN_CHAT, `🐦 *TWITTER — paste to @signalcrypto_id*\n\n\`\`\`\n${content?.twitter}\n\`\`\``);
      await new Promise(r => setTimeout(r, 400));

      // IG card URL
      const igCardUrl = `${SITE_URL}/api/marketing-agent?action=ig-card`;
      await tgSend(ADMIN_CHAT, `📸 *INSTAGRAM — @crypto.signal.id*\n\n*Step 1:* Open this link → screenshot the image (1080x1080):\n${igCardUrl}\n\n*Step 2:* Post the screenshot with this caption:\n\n\`\`\`\n${content?.instagram_caption}\n\`\`\``);
      await new Promise(r => setTimeout(r, 400));

      // TikTok script
      await tgSend(ADMIN_CHAT, `🎵 *TIKTOK — @cryptosignal.id*\n\n*Record 30-60s screen recording of cryptosignal.id*\n\n*Text overlays to add:*\n\n🎯 Hook (first 2s): \`${content?.tiktok_hook}\`\n\n• ${content?.tiktok_bullet1}\n• ${content?.tiktok_bullet2}\n• ${content?.tiktok_bullet3}\n\n*End screen CTA:* \`Follow @cryptosignal.id untuk sinyal harian!\`\n\n*Caption:*\n\`\`\`\n${content?.instagram_caption}\n\`\`\``);
      await new Promise(r => setTimeout(r, 400));

      // YouTube
      await tgSend(ADMIN_CHAT, `▶️ *YOUTUBE — cryptosignal_id Community tab*\n\n*Step 1:* Go to youtube.com/channel → Community tab → Create post\n*Step 2:* Upload the same IG screenshot\n*Step 3:* Paste this text:\n\n\`\`\`\n${content?.youtube_title}\n\n${content?.youtube_body}\n\`\`\``);
      await new Promise(r => setTimeout(r, 400));

      await tgSend(ADMIN_CHAT, `✅ *Your 2-min checklist:*\n\n☐ Twitter — paste & tweet\n☐ Instagram — screenshot card + paste caption\n☐ TikTok — record screen + add text overlays\n☐ YouTube Community — upload same screenshot + paste text\n\n_Telegram @cryptosignal_id already posted_ ✅\n\n📸 *IG Card:* ${igCardUrl}`);
    }

    return res.status(200).json({ ok: true, telegram_channel: tgOk, admin_notified: !!ADMIN_CHAT });

  } catch(err) {
    console.error('Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
