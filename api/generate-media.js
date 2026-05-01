// api/generate-media.js
// Generates daily crypto image cards + video scripts
// Sends photo album + ready-to-post content to Telegram channel
// Called by daily-digest.js every morning at 08:00 WIB

const TG_BOT_TOKEN  = process.env.TG_BOT_TOKEN;
const TG_CHANNEL_ID = process.env.TG_CHANNEL_ID; // Your Telegram channel ID e.g. @cryptosignal_id or -100xxxxxxxxx
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;
const CG_KEY        = process.env.CG_KEY || 'CG-LUGa4vpkw7FgUiQ3wyGWaeVp';
const GNEWS_KEY     = process.env.GNEWS_KEY || '204f00771794b2f674c4f2e4a924623d';
const CRON_SECRET   = process.env.CRON_SECRET || 'cs-cron-secret';

// ── Fetch market data ──
async function getMarketData() {
  const [pricesRes, globalRes, fngRes, trendingRes] = await Promise.allSettled([
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,ripple&vs_currencies=usd&include_24hr_change=true&x_cg_demo_api_key=${CG_KEY}`),
    fetch(`https://api.coingecko.com/api/v3/global?x_cg_demo_api_key=${CG_KEY}`),
    fetch('https://api.alternative.me/fng/?limit=2&format=json'),
    fetch(`https://api.coingecko.com/api/v3/search/trending?x_cg_demo_api_key=${CG_KEY}`),
  ]);
  return {
    prices:   pricesRes.status === 'fulfilled' && pricesRes.value.ok   ? await pricesRes.value.json()   : {},
    global:   globalRes.status === 'fulfilled' && globalRes.value.ok   ? (await globalRes.value.json()).data : {},
    fng:      fngRes.status === 'fulfilled' && fngRes.value.ok         ? (await fngRes.value.json()).data : [],
    trending: trendingRes.status === 'fulfilled' && trendingRes.value.ok ? (await trendingRes.value.json()).coins?.slice(0,5).map(c=>c.item) : [],
  };
}

async function getTopNews() {
  try {
    const r = await fetch(`https://gnews.io/api/v4/search?q=bitcoin+crypto&lang=en&max=3&sortby=publishedAt&apikey=${GNEWS_KEY}`, { signal: AbortSignal.timeout(8000) });
    return r.ok ? (await r.json()).articles?.slice(0,3) || [] : [];
  } catch { return []; }
}

// ── Format helpers ──
const fmtUSD  = n => n >= 1000 ? '$' + n.toLocaleString('en-US',{maximumFractionDigits:0}) : '$' + n?.toFixed(2);
const fmtPct  = n => (n>=0?'▲ +':'▼ ')+Math.abs(n).toFixed(2)+'%';
const fmtCap  = n => n>=1e12 ? '$'+(n/1e12).toFixed(2)+'T' : '$'+(n/1e9).toFixed(1)+'B';
const fmtDate = () => new Date().toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Jakarta'});
const fmtTime = () => new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'})+' WIB';

// ── Generate SVG image card (sent as photo to Telegram) ──
// Telegram accepts SVG converted to PNG via sharp, or we use HTML→PNG via external service
// Simplest: Generate as clean text-based image using Telegram's MarkdownV2 with monospace

function generateImageSVG(card, data) {
  const { prices, global, fng, trending } = data;
  const btc = prices.bitcoin || {};
  const eth = prices.ethereum || {};
  const sol = prices.solana || {};
  const fngScore = parseInt(fng[0]?.value || 50);
  const fngLabel = fng[0]?.value_classification || 'Neutral';
  const capChg = global.market_cap_change_percentage_24h_usd || 0;
  const totalCap = fmtCap(global.total_market_cap?.usd || 0);
  const btcDom = (global.market_cap_percentage?.btc || 0).toFixed(1);

  const fngColor = fngScore <= 20 ? '#ef4444' : fngScore <= 40 ? '#f97316' : fngScore <= 60 ? '#eab308' : fngScore <= 80 ? '#22c55e' : '#10b981';
  const btcColor = (btc.usd_24h_change || 0) >= 0 ? '#22d98a' : '#f55070';
  const ethColor = (eth.usd_24h_change || 0) >= 0 ? '#22d98a' : '#f55070';
  const solColor = (sol.usd_24h_change || 0) >= 0 ? '#22d98a' : '#f55070';
  const marketColor = capChg >= 0 ? '#22d98a' : '#f55070';

  const trendList = trending.slice(0,5).map((t,i) =>
    `<text x="60" y="${370+i*28}" font-size="13" fill="#94a3c0">🔥 ${i+1}. ${t.name} (${t.symbol?.toUpperCase()})</text>`
  ).join('\n');

  if (card === 'main') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#080e1c"/>
      <stop offset="100%" style="stop-color:#0d1a2e"/>
    </linearGradient>
    <linearGradient id="card" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#131f33;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#0f1927;stop-opacity:1"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1080" height="1080" fill="url(#bg)"/>
  <!-- Grid pattern -->
  <line x1="0" y1="200" x2="1080" y2="200" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <line x1="0" y1="400" x2="1080" y2="400" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <line x1="0" y1="600" x2="1080" y2="600" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <line x1="0" y1="800" x2="1080" y2="800" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <line x1="200" y1="0" x2="200" y2="1080" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <line x1="540" y1="0" x2="540" y2="1080" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
  <line x1="880" y1="0" x2="880" y2="1080" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>

  <!-- Header bar -->
  <rect x="0" y="0" width="1080" height="100" fill="rgba(0,212,255,0.06)"/>
  <rect x="0" y="96" width="1080" height="4" fill="url(#accent)"/>
  <defs>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00d4ff"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>

  <!-- Logo / Brand -->
  <rect x="40" y="22" width="56" height="56" rx="14" fill="url(#accent)"/>
  <text x="68" y="60" font-family="Arial Black,sans-serif" font-size="26" font-weight="900" fill="white" text-anchor="middle">⚡</text>
  <text x="114" y="48" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="white">Crypto</text>
  <text x="197" y="48" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#00d4ff">Signal</text>
  <text x="114" y="72" font-family="Arial,sans-serif" font-size="13" fill="#5a6a8a">AI Market Intelligence</text>

  <!-- Date/Time top right -->
  <text x="1040" y="44" font-family="Arial,sans-serif" font-size="14" fill="#5a6a8a" text-anchor="end">${fmtDate()}</text>
  <text x="1040" y="66" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#94a3c0" text-anchor="end">${fmtTime()}</text>

  <!-- LIVE pill -->
  <rect x="1000" y="74" width="60" height="22" rx="11" fill="rgba(34,217,138,0.12)" stroke="rgba(34,217,138,0.3)" stroke-width="1"/>
  <circle cx="1012" cy="85" r="4" fill="#22d98a"><animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite"/></circle>
  <text x="1032" y="90" font-family="Arial,sans-serif" font-size="11" font-weight="700" fill="#22d98a">LIVE</text>

  <!-- Main headline -->
  <text x="540" y="165" font-family="Arial Black,sans-serif" font-size="36" font-weight="900" fill="white" text-anchor="middle">DAILY CRYPTO BRIEF</text>
  <text x="540" y="200" font-family="Arial,sans-serif" font-size="18" fill="#5a6a8a" text-anchor="middle">Market Intelligence Report</text>

  <!-- Fear & Greed card -->
  <rect x="40" y="225" width="480" height="160" rx="16" fill="url(#card)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="70" y="265" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#5a6a8a" letter-spacing="1">FEAR &amp; GREED INDEX</text>
  <text x="70" y="320" font-family="Arial Black,sans-serif" font-size="64" font-weight="900" fill="${fngColor}">${fngScore}</text>
  <text x="200" y="310" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="${fngColor}">${fngLabel}</text>
  <text x="200" y="340" font-family="Arial,sans-serif" font-size="14" fill="#5a6a8a">out of 100</text>
  <!-- F&G bar -->
  <rect x="70" y="355" width="420" height="8" rx="4" fill="rgba(255,255,255,0.06)"/>
  <rect x="70" y="355" width="${Math.round(fngScore/100*420)}" height="8" rx="4" fill="${fngColor}"/>

  <!-- Market cap card -->
  <rect x="560" y="225" width="480" height="160" rx="16" fill="url(#card)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <text x="590" y="265" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#5a6a8a" letter-spacing="1">GLOBAL MARKET CAP</text>
  <text x="590" y="315" font-family="Arial Black,sans-serif" font-size="42" font-weight="900" fill="white">${totalCap}</text>
  <text x="590" y="350" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="${marketColor}">${fmtPct(capChg)} 24h</text>
  <text x="590" y="375" font-family="Arial,sans-serif" font-size="14" fill="#5a6a8a">BTC Dominance: ${btcDom}%</text>

  <!-- BTC card -->
  <rect x="40" y="410" width="320" height="140" rx="16" fill="url(#card)" stroke="rgba(247,147,26,0.2)" stroke-width="1"/>
  <text x="70" y="445" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#f7931a" letter-spacing="1">₿ BITCOIN</text>
  <text x="70" y="495" font-family="Arial Black,sans-serif" font-size="32" font-weight="900" fill="white">${btc.usd ? fmtUSD(btc.usd) : '—'}</text>
  <text x="70" y="530" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="${btcColor}">${btc.usd_24h_change ? fmtPct(btc.usd_24h_change) : '—'}</text>

  <!-- ETH card -->
  <rect x="380" y="410" width="320" height="140" rx="16" fill="url(#card)" stroke="rgba(98,126,234,0.2)" stroke-width="1"/>
  <text x="410" y="445" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#627eea" letter-spacing="1">Ξ ETHEREUM</text>
  <text x="410" y="495" font-family="Arial Black,sans-serif" font-size="32" font-weight="900" fill="white">${eth.usd ? fmtUSD(eth.usd) : '—'}</text>
  <text x="410" y="530" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="${ethColor}">${eth.usd_24h_change ? fmtPct(eth.usd_24h_change) : '—'}</text>

  <!-- SOL card -->
  <rect x="720" y="410" width="320" height="140" rx="16" fill="url(#card)" stroke="rgba(153,69,255,0.2)" stroke-width="1"/>
  <text x="750" y="445" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#9945ff" letter-spacing="1">◎ SOLANA</text>
  <text x="750" y="495" font-family="Arial Black,sans-serif" font-size="32" font-weight="900" fill="white">${sol.usd ? fmtUSD(sol.usd) : '—'}</text>
  <text x="750" y="530" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="${solColor}">${sol.usd_24h_change ? fmtPct(sol.usd_24h_change) : '—'}</text>

  <!-- Trending section -->
  <rect x="40" y="575" width="480" height="195" rx="16" fill="url(#card)" stroke="rgba(167,139,250,0.2)" stroke-width="1"/>
  <text x="70" y="612" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#a78bfa" letter-spacing="1">🔥 TRENDING COINS</text>
  ${trendList}

  <!-- Signal stats -->
  <rect x="560" y="575" width="480" height="195" rx="16" fill="url(#card)" stroke="rgba(0,212,255,0.15)" stroke-width="1"/>
  <text x="590" y="612" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#00d4ff" letter-spacing="1">⚡ TODAY'S SIGNAL STATS</text>
  <text x="590" y="650" font-family="Arial,sans-serif" font-size="14" fill="#94a3c0">Sources Active:</text>
  <text x="800" y="650" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#22d98a">13+ live feeds</text>
  <text x="590" y="680" font-family="Arial,sans-serif" font-size="14" fill="#94a3c0">Signal Updates:</text>
  <text x="800" y="680" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#00d4ff">Every 90 seconds</text>
  <text x="590" y="710" font-family="Arial,sans-serif" font-size="14" fill="#94a3c0">AI Detection:</text>
  <text x="800" y="710" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#a78bfa">Hoax + Sentiment</text>
  <text x="590" y="740" font-family="Arial,sans-serif" font-size="14" fill="#94a3c0">Alert System:</text>
  <text x="800" y="740" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#fbbf24">Telegram Instant Push</text>

  <!-- Footer CTA -->
  <rect x="40" y="793" width="1000" height="90" rx="16" fill="url(#accent)" opacity="0.08"/>
  <rect x="40" y="793" width="1000" height="90" rx="16" stroke="rgba(0,212,255,0.25)" stroke-width="1" fill="none"/>
  <text x="540" y="833" font-family="Arial Black,sans-serif" font-size="22" font-weight="900" fill="white" text-anchor="middle">🔗 cryptosignal.id</text>
  <text x="540" y="863" font-family="Arial,sans-serif" font-size="15" fill="#5a6a8a" text-anchor="middle">Real-time AI crypto signals • Pro alerts from Rp 449K/month</text>

  <!-- Bottom watermark -->
  <text x="540" y="955" font-family="Arial,sans-serif" font-size="13" fill="#2a3a55" text-anchor="middle">Generated by CryptoSignal AI • ${fmtDate()}</text>
</svg>`;
  }
  return null;
}

// ── Build ALL social media content package ──
function buildContentPackage(data, news) {
  const { prices, global, fng, trending } = data;
  const btc = prices.bitcoin || {};
  const eth = prices.ethereum || {};
  const sol = prices.solana || {};
  const fngScore = parseInt(fng[0]?.value || 50);
  const fngLabel = fng[0]?.value_classification || 'Neutral';
  const capChg = global.market_cap_change_percentage_24h_usd || 0;
  const totalCap = fmtCap(global.total_market_cap?.usd || 0);
  const btcDom = (global.market_cap_percentage?.btc || 0).toFixed(1);
  const fngEmoji = fngScore<=20?'😱':fngScore<=40?'😨':fngScore<=60?'😐':fngScore<=80?'😏':'🤑';
  const marketEmoji = capChg >= 0 ? '🟢' : '🔴';
  const trend1 = trending[0]?.symbol?.toUpperCase() || 'CRYPTO';
  const trend2 = trending[1]?.symbol?.toUpperCase() || 'BTC';
  const trend3 = trending[2]?.symbol?.toUpperCase() || 'ETH';
  const date = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'});
  const topNews = news[0]?.title?.substring(0,100) || 'Pasar crypto bergerak aktif hari ini';

  // ── 1. TIKTOK SCRIPT (13 seconds) ──
  const tiktokScript = `🎬 TIKTOK SCRIPT — 13 DETIK
━━━━━━━━━━━━━━━━━━━━━
[0-2s] TEXT ON SCREEN: "CRYPTO UPDATE ${date}"
       VOICEOVER: "Update crypto pagi ini!"

[2-5s] TEXT: "BTC ${btc.usd ? fmtUSD(btc.usd) : '—'} ${btc.usd_24h_change ? '('+fmtPct(btc.usd_24h_change)+')' : ''}"
       VOICEOVER: "Bitcoin saat ini di ${btc.usd ? fmtUSD(btc.usd) : '—'}"

[5-8s] TEXT: "Fear & Greed: ${fngScore}/100 — ${fngLabel} ${fngEmoji}"
       VOICEOVER: "Sentimen pasar: ${fngLabel}. Artinya ${fngScore<=40?'peluang beli untuk smart money!':fngScore>=60?'hati-hati, pasar sudah greed!':'tunggu konfirmasi arah!'}"

[8-11s] TEXT: "🔥 TRENDING: #${trend1} #${trend2} #${trend3}"
        VOICEOVER: "Coin trending hari ini: ${trend1}, ${trend2}, ${trend3}"

[11-13s] TEXT: "📲 cryptosignal.id — Signal live setiap 90 detik!"
         VOICEOVER: "Follow untuk update live! Link di bio!"

━━━━━━━━━━━━━━━━━━━━━
📝 CAPTION TIKTOK (copy-paste):

🚨 CRYPTO UPDATE ${date}

₿ BTC: ${btc.usd ? fmtUSD(btc.usd) : '—'} ${btc.usd_24h_change ? fmtPct(btc.usd_24h_change) : ''}
${fngEmoji} Fear & Greed: ${fngScore}/100 (${fngLabel})
${marketEmoji} Market: ${capChg>=0?'+':''}${capChg.toFixed(1)}% 24h
🔥 Trending: #${trend1} #${trend2} #${trend3}

${fngScore<=35?'🎯 Zona fear = peluang beli smart money':fngScore>=65?'⚠️ Zona greed = mulai ambil profit':'⏳ Zona neutral = tunggu konfirmasi'}

📊 Signal live tiap 90 detik → cryptosignal.id
Upgrade Pro dapat alert Telegram langsung! ⚡

#crypto #bitcoin #ethereum #kripto #bitcoinindonesia #investasikripto #altcoin #${trend1.toLowerCase()} #${trend2.toLowerCase()} #cryptosignal #tradingcrypto #kriptoindonesia`;

  // ── 2. YOUTUBE SCRIPT (30 seconds) ──
  const youtubeScript = `🎬 YOUTUBE SHORTS SCRIPT — 30 DETIK
━━━━━━━━━━━━━━━━━━━━━
[0-3s]  HOOK: "Crypto turun atau naik hari ini? Saya kasih tahu dalam 30 detik!"
        VISUAL: Logo CryptoSignal + tanggal

[3-8s]  MARKET OVERVIEW:
        VOICEOVER: "Total market cap crypto hari ini ${totalCap}, ${capChg>=0?'naik':'turun'} ${Math.abs(capChg).toFixed(1)}% dalam 24 jam."
        VISUAL: Market cap card dengan angka besar

[8-14s] BITCOIN FOCUS:
        VOICEOVER: "Bitcoin di ${btc.usd ? fmtUSD(btc.usd) : '—'}, ${(btc.usd_24h_change||0)>=0?'naik':'turun'} ${Math.abs(btc.usd_24h_change||0).toFixed(1)}% hari ini."
        VISUAL: BTC price card

[14-20s] SENTIMENT:
         VOICEOVER: "Fear & Greed Index di angka ${fngScore} — kategori ${fngLabel}. ${fngScore<=35?'Ini sinyal historis untuk akumulasi!':fngScore>=65?'Pasar sudah terlalu euphoria, hati-hati!':'Pasar masih menunggu arah yang jelas.'}"
         VISUAL: F&G gauge animation

[20-25s] TOP NEWS:
         VOICEOVER: "Berita terpanas hari ini: ${topNews.substring(0,80)}"
         VISUAL: News card

[25-28s] TRENDING:
         VOICEOVER: "Trending sekarang: ${trend1}, ${trend2}, ${trend3}!"
         VISUAL: Trending coins bar

[28-30s] CTA:
         VOICEOVER: "Dapatkan signal live tiap 90 detik di cryptosignal.id. Link di deskripsi!"
         VISUAL: CTA card + website

━━━━━━━━━━━━━━━━━━━━━
📝 DESCRIPTION YOUTUBE (copy-paste):

🚨 UPDATE CRYPTO ${date} | ${btc.usd?fmtUSD(btc.usd):'—'} | Fear & Greed ${fngScore}

Ringkasan market crypto hari ini:
• Bitcoin: ${btc.usd?fmtUSD(btc.usd):'—'} (${btc.usd_24h_change?fmtPct(btc.usd_24h_change):'—'})
• Ethereum: ${eth.usd?fmtUSD(eth.usd):'—'} (${eth.usd_24h_change?fmtPct(eth.usd_24h_change):'—'})
• Solana: ${sol.usd?fmtUSD(sol.usd):'—'} (${sol.usd_24h_change?fmtPct(sol.usd_24h_change):'—'})
• Fear & Greed: ${fngScore}/100 (${fngLabel})
• Market Cap: ${totalCap} (${capChg>=0?'+':''}${capChg.toFixed(1)}%)
• BTC Dominance: ${btcDom}%

🔥 Trending: ${trend1}, ${trend2}, ${trend3}

📊 Signal live real-time: https://cryptosignal.id
⚡ Pro alerts Telegram: https://cryptosignal.id/pro.html

#crypto #bitcoin #ethereum #kripto #kriptoindonesia #bitcoinindonesia #altcoin #defi #tradingcrypto #investasikripto #cryptosignal`;

  // ── 3. INSTAGRAM CAPTION ──
  const igCaption = `📊 CRYPTO MORNING BRIEF
${date} • ${fmtTime()}

━━━━━━━━━━━━━━━━━━━━━
💰 HARGA SAAT INI
₿ BTC   ${btc.usd?fmtUSD(btc.usd):'—'}   ${btc.usd_24h_change?fmtPct(btc.usd_24h_change):''}
Ξ ETH   ${eth.usd?fmtUSD(eth.usd):'—'}   ${eth.usd_24h_change?fmtPct(eth.usd_24h_change):''}
◎ SOL   ${sol.usd?fmtUSD(sol.usd):'—'}   ${sol.usd_24h_change?fmtPct(sol.usd_24h_change):''}

${fngEmoji} SENTIMEN PASAR: ${fngScore}/100 — ${fngLabel}
${fngScore<=35?'📌 Zona fear = peluang akumulasi':fngScore>=65?'📌 Zona greed = manage risiko!':'📌 Netral = tunggu breakout'}

${marketEmoji} Market Cap: ${totalCap} (${capChg>=0?'+':''}${capChg.toFixed(1)}% 24h)

🔥 TRENDING HARI INI:
${trending.slice(0,5).map((t,i)=>`${i+1}. ${t.name} ($${t.symbol?.toUpperCase()})`).join('\n')}

📰 TOP NEWS:
${news.slice(0,2).map((n,i)=>`${i+1}. ${n.title?.substring(0,80)}...`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━
📲 Signal live setiap 90 detik
🔗 cryptosignal.id
⚡ Pro Alert Telegram: Rp 449K/bulan

#crypto #bitcoin #ethereum #kripto #bitcoinindonesia #kriptoindonesia #investasikripto #altcoin #defi #nft #blockchain #tradingcrypto #coinbase #binance #${trend1.toLowerCase()} #${trend2.toLowerCase()} #${trend3.toLowerCase()} #cryptosignal #fearandgreed #marketupdate`;

  // ── 4. TWITTER/X THREAD ──
  const twitterThread = `🧵 CRYPTO BRIEF ${date}
(Thread 1/4)

₿ BTC: ${btc.usd?fmtUSD(btc.usd):'—'} ${btc.usd_24h_change?fmtPct(btc.usd_24h_change):''}
${fngEmoji} Fear & Greed: ${fngScore} — ${fngLabel}
${marketEmoji} Market: ${totalCap} (${capChg>=0?'+':''}${capChg.toFixed(1)}%)

—

2/ SENTIMEN PASAR ${fngEmoji}

Fear & Greed Index: ${fngScore}/100
${fngScore<=20?'😱 EXTREME FEAR — smart money sedang akumulasi':fngScore<=40?'😨 FEAR — pasar oversold, watch reversal':fngScore<=60?'😐 NEUTRAL — tunggu konfirmasi':fngScore<=80?'😏 GREED — momentum ada, jaga risiko':'🤑 EXTREME GREED — potensi koreksi tinggi'}

—

3/ 🔥 TRENDING SEKARANG

${trending.slice(0,5).map((t,i)=>`${i+1}. $${t.symbol?.toUpperCase()} (${t.name})`).join('\n')}

Coin trending sering mendahului price action 24-48 jam!

—

4/ 📰 BERITA TERPANAS

${news.slice(0,2).map(n=>`• ${n.title?.substring(0,100)}`).join('\n\n')}

Signal lengkap → cryptosignal.id ⚡
Pro alerts Telegram → cryptosignal.id/pro.html

#Bitcoin #Crypto #Kripto #CryptoSignal`;

  return { tiktokScript, youtubeScript, igCaption, twitterThread };
}

// ── Send photo to Telegram ──
async function tgSendPhoto(chatId, svgContent, caption) {
  if (!chatId || !TG_BOT_TOKEN) return false;
  // Convert SVG to PNG via external service (api.html2image.com or similar)
  // For now: send as document with SVG, or use a base64 approach
  // Best free option: htmlcsstoimage.com API (free tier: 50/month)
  // Alternative: Send the market data as a beautifully formatted text message instead
  
  // Send caption text (the image will be the SVG converted externally)
  // We'll use the Telegram sendMessage with formatted text as the "image alternative"
  try {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    });
    return true;
  } catch { return false; }
}

// ── Send text message in chunks ──
async function tgSend(chatId, text, parseMode = 'Markdown') {
  if (!chatId || !TG_BOT_TOKEN) return false;
  const chunks = [];
  for (let i = 0; i < text.length; i += 3800) chunks.push(text.slice(i, i + 3800));
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: parseMode }),
    }).catch(e => console.error('TG error:', e.message));
    await new Promise(r => setTimeout(r, 500));
  }
  return true;
}

// ── Main handler ──
export default async function handler(req, res) {
  if (req.method === 'GET' && req.query.secret !== CRON_SECRET) {
    return res.status(401).json({ message: 'Unauthorized — add ?secret=YOUR_CRON_SECRET' });
  }

  try {
    console.log('Generating daily media package...');
    const [data, news] = await Promise.all([getMarketData(), getTopNews()]);
    const { prices, global, fng, trending } = data;
    const btc = prices.bitcoin || {};
    const fngScore = parseInt(fng[0]?.value || 50);
    const fngLabel = fng[0]?.value_classification || 'Neutral';
    const fngEmoji = fngScore<=20?'😱':fngScore<=40?'😨':fngScore<=60?'😐':fngScore<=80?'😏':'🤑';
    const capChg = global.market_cap_change_percentage_24h_usd || 0;
    const date = fmtDate();

    // Build content package
    const { tiktokScript, youtubeScript, igCaption, twitterThread } = buildContentPackage(data, news);

    // ── TELEGRAM CHANNEL: Send visual market card (formatted text) ──
    const channelCard = `📊 *CRYPTOSIGNAL DAILY BRIEF*
${date} | ${fmtTime()}

💰 *HARGA SEKARANG*
\`₿ BTC  ${btc.usd?fmtUSD(btc.usd):'—'}  ${btc.usd_24h_change?fmtPct(btc.usd_24h_change):''}\`
\`Ξ ETH  ${prices.ethereum?.usd?fmtUSD(prices.ethereum.usd):'—'}  ${prices.ethereum?.usd_24h_change?fmtPct(prices.ethereum.usd_24h_change):''}\`
\`◎ SOL  ${prices.solana?.usd?fmtUSD(prices.solana.usd):'—'}  ${prices.solana?.usd_24h_change?fmtPct(prices.solana.usd_24h_change):''}\`

${fngEmoji} *Fear & Greed: ${fngScore}/100 — ${fngLabel}*
📊 Market Cap: *${fmtCap(global.total_market_cap?.usd||0)}* (${capChg>=0?'+':''}${capChg.toFixed(1)}%)
🔥 Trending: ${trending.slice(0,3).map(t=>`$${t.symbol?.toUpperCase()}`).join(' · ')}

🔗 Signal live: [cryptosignal.id](https://cryptosignal.id)
⚡ Pro alerts: [Upgrade Rp 449K/mo](https://cryptosignal.id/pro.html)`;

    // Send to channel
    if (TG_CHANNEL_ID) {
      await tgSend(TG_CHANNEL_ID, channelCard);
      console.log('Sent to channel:', TG_CHANNEL_ID);
    }

    // ── OWNER: Send full content package ──
    if (OWNER_CHAT_ID) {
      const ownerHeader = `🎬 *CONTENT PACKAGE HARIAN — ${date}*
━━━━━━━━━━━━━━━━━━━━━
Semua konten siap copy-paste!
3 format: TikTok • YouTube • Instagram • Twitter
━━━━━━━━━━━━━━━━━━━━━`;

      await tgSend(OWNER_CHAT_ID, ownerHeader);
      await new Promise(r => setTimeout(r, 800));
      await tgSend(OWNER_CHAT_ID, tiktokScript);
      await new Promise(r => setTimeout(r, 800));
      await tgSend(OWNER_CHAT_ID, youtubeScript);
      await new Promise(r => setTimeout(r, 800));
      await tgSend(OWNER_CHAT_ID, `📸 *INSTAGRAM CAPTION:*\n\n${igCaption}`);
      await new Promise(r => setTimeout(r, 800));
      await tgSend(OWNER_CHAT_ID, `🐦 *TWITTER/X THREAD:*\n\n${twitterThread}`);
      console.log('Sent content package to owner:', OWNER_CHAT_ID);
    }

    return res.status(200).json({
      ok: true,
      date,
      sent_to_channel: !!TG_CHANNEL_ID,
      sent_to_owner: !!OWNER_CHAT_ID,
      content_types: ['channel_card','tiktok_script','youtube_script','ig_caption','twitter_thread'],
    });

  } catch (err) {
    console.error('generate-media error:', err.message);
    return res.status(500).json({ message: err.message });
  }
}
