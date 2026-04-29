// api/marketing-agent.js
// Runs daily at 9am WIB via Vercel cron
// Generates ready-to-post content for ALL platforms
// Sends everything to Julius's Telegram — he copy-pastes in 2 min

const TG_BOT_TOKEN  = process.env.TG_BOT_TOKEN || '8731034518:AAHTpe89-toSMtlV5N_gYu__Zy5-EVUU8tA';
const TG_CHANNEL    = process.env.TG_CHANNEL_ID || '@cryptosignal_id';
const ADMIN_CHAT    = process.env.TG_ADMIN_CHAT_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

async function getMarketData() {
  try {
    const [fgRes, cgRes] = await Promise.all([
      fetch('https://api.alternative.me/fng/?limit=1'),
      fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=5&sparkline=false'),
    ]);
    const fg = await fgRes.json();
    const cg = await cgRes.json();
    return {
      fearGreed: fg.data?.[0],
      coins: cg.map(c => ({
        symbol: c.symbol.toUpperCase(),
        price: c.current_price,
        change24h: (+c.price_change_percentage_24h).toFixed(2),
      })),
    };
  } catch(e) { return null; }
}

async function generateAllContent(market) {
  const btc = market?.coins?.find(c => c.symbol === 'BTC');
  const eth = market?.coins?.find(c => c.symbol === 'ETH');
  const sol = market?.coins?.find(c => c.symbol === 'SOL');
  const fg  = market?.fearGreed;
  const btcArrow = btc?.change24h > 0 ? '📈' : '📉';
  const fgEmoji  = fg?.value < 25 ? '😱' : fg?.value < 45 ? '😨' : fg?.value < 55 ? '😐' : fg?.value < 75 ? '😊' : '🤑';

  if (!ANTHROPIC_KEY) return buildFallbackContent(market);

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
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `You are a crypto content creator for CryptoSignal.id, targeting Indonesian crypto traders.

TODAY'S MARKET DATA:
- Fear & Greed: ${fg?.value}/100 (${fg?.value_classification}) ${fgEmoji}
- BTC: $${btc?.price?.toLocaleString()} (${btc?.change24h}% 24h) ${btcArrow}
- ETH: $${eth?.price?.toLocaleString()} (${eth?.change24h}% 24h)
- SOL: $${sol?.price?.toLocaleString()} (${sol?.change24h}% 24h)

Create content for 5 platforms. Return ONLY raw JSON, no markdown backticks:

{
  "telegram_channel": "Markdown post for @cryptosignal_id channel. Use *bold* and emojis. Show F&G + top 3 prices. Max 300 chars. End with: 📡 Signal live → cryptosignal.id",
  
  "twitter": "Tweet max 240 chars. Crypto alpha tone. Show BTC price movement + F&G. Include market insight. End: cryptosignal.id | @signalcrypto_id",
  
  "instagram": "IG caption. Strong emoji hook on line 1. Lines 2-4: market insights mixing Indonesian and English. Line 5: CTA. Then blank line. Then hashtags: #cryptosignal #kripto #bitcoin #ethereum #tradingcrypto #cryptoindonesia #btc #investasi #altcoin #blockchain #sinyal #trader",
  
  "tiktok": "TikTok video script. Hook (3 words max, all caps). Then 3 bullet points as text overlay ideas. Then CTA. Format: HOOK:\\n• point1\\n• point2\\n• point3\\nCTA: Follow @cryptosignal.id for daily signals!",
  
  "youtube": "YouTube Community post. Longer form. Market analysis tone. 3-4 sentences. Professional but accessible. Indonesian OK. End with question to drive comments. Add: Subscribe untuk sinyal crypto harian ⚡ cryptosignal.id"
}`
        }],
      }),
    });
    const d = await r.json();
    const text = (d.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    return JSON.parse(text);
  } catch(e) {
    console.error('Claude error:', e.message);
    return buildFallbackContent(market);
  }
}

function buildFallbackContent(market) {
  const btc = market?.coins?.find(c => c.symbol === 'BTC');
  const eth = market?.coins?.find(c => c.symbol === 'ETH');
  const fg  = market?.fearGreed;
  return {
    telegram_channel: `⚡ *CryptoSignal Daily*\n\n🧠 F&G: *${fg?.value}/100* (${fg?.value_classification})\n₿ BTC: *$${btc?.price?.toLocaleString()}* (${btc?.change24h}%)\nΞ ETH: *$${eth?.price?.toLocaleString()}* (${eth?.change24h}%)\n\n📡 Signal live → cryptosignal.id`,
    twitter: `⚡ Crypto update: F&G ${fg?.value}/100 | BTC $${btc?.price?.toLocaleString()} (${btc?.change24h}%) | ETH $${eth?.price?.toLocaleString()} | Live signals → cryptosignal.id`,
    instagram: `⚡ Market Update!\n\nFear & Greed: ${fg?.value}/100 (${fg?.value_classification})\nBTC: $${btc?.price?.toLocaleString()} (${btc?.change24h}%)\n\nCek sinyal crypto live di cryptosignal.id\n\n#cryptosignal #kripto #bitcoin #btc #trading`,
    tiktok: `BTC ${btc?.change24h > 0 ? 'NAIK' : 'TURUN'} ${Math.abs(btc?.change24h)}%\n\n• Fear & Greed: ${fg?.value}/100\n• BTC: $${btc?.price?.toLocaleString()}\n• Cek sinyal di cryptosignal.id\n\nFollow @cryptosignal.id untuk sinyal harian!`,
    youtube: `Market update hari ini: Fear & Greed Index berada di ${fg?.value}/100 menunjukkan sentimen ${fg?.value_classification}. Bitcoin saat ini di $${btc?.price?.toLocaleString()} dengan pergerakan ${btc?.change24h}% dalam 24 jam. Bagaimana strategi trading kamu hari ini? Subscribe untuk sinyal crypto harian ⚡ cryptosignal.id`,
  };
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
  const secret = req.headers['x-vercel-cron-secret'] ||
                 req.query.secret ||
                 req.headers['authorization']?.replace('Bearer ', '');

  if (secret !== process.env.CRON_SECRET && req.headers['x-vercel-cron'] !== '1') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('🚀 Marketing agent:', new Date().toISOString());

  try {
    const market  = await getMarketData();
    const content = await generateAllContent(market);
    const btc     = market?.coins?.find(c => c.symbol === 'BTC');
    const fg      = market?.fearGreed;
    const date    = new Date().toLocaleDateString('id-ID', { 
      timeZone: 'Asia/Jakarta', 
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
    });

    // 1. Post to Telegram channel
    const tgOk = await tgSend(TG_CHANNEL, content.telegram_channel);
    console.log('TG channel:', tgOk ? '✅' : '❌');

    // 2. Send full content pack to Julius's personal Telegram
    if (ADMIN_CHAT) {

      // Message 1: Header
      await tgSend(ADMIN_CHAT, `📊 *CryptoSignal Daily Content Pack*\n${date}\n\nBTC: $${btc?.price?.toLocaleString()} (${btc?.change24h}%)\nF&G: ${fg?.value}/100 (${fg?.value_classification})\n\n✅ Telegram @cryptosignal_id: POSTED\n\n_Copy-paste content below 👇_`);

      await new Promise(r => setTimeout(r, 500));

      // Message 2: Twitter
      await tgSend(ADMIN_CHAT, `🐦 *TWITTER @signalcrypto_id*\n_Go to: twitter.com → post_\n\n\`\`\`\n${content.twitter}\n\`\`\``);

      await new Promise(r => setTimeout(r, 500));

      // Message 3: Instagram
      await tgSend(ADMIN_CHAT, `📸 *INSTAGRAM @crypto.signal.id*\n_Post with BTC chart screenshot_\n\n\`\`\`\n${content.instagram}\n\`\`\``);

      await new Promise(r => setTimeout(r, 500));

      // Message 4: TikTok
      await tgSend(ADMIN_CHAT, `🎵 *TIKTOK @cryptosignal.id*\n_Record 30-60s screen recording of cryptosignal.id with this script:_\n\n\`\`\`\n${content.tiktok}\n\`\`\``);

      await new Promise(r => setTimeout(r, 500));

      // Message 5: YouTube
      await tgSend(ADMIN_CHAT, `▶️ *YOUTUBE cryptosignal_id*\n_Post as Community tab update_\n\n\`\`\`\n${content.youtube}\n\`\`\``);

      await new Promise(r => setTimeout(r, 500));

      // Message 6: Done summary
      await tgSend(ADMIN_CHAT, `✅ *Done! Your 2-minute checklist:*\n\n☐ Twitter — paste & post\n☐ Instagram — screenshot + paste\n☐ TikTok — record + paste script\n☐ YouTube Community — paste\n\n_Telegram already posted automatically_ ✅`);
    }

    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      telegram_channel: tgOk,
      admin_notified: !!ADMIN_CHAT,
    });

  } catch(err) {
    console.error('Error:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
