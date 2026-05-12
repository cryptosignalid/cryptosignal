// api/morning-brief.js
// SINGLE combined cron — replaces daily-digest.js + generate-media.js
// Vercel Hobby only allows 1 cron per day — this is the ONE cron
// Schedule: 0 1 * * * (01:00 UTC = 08:00 WIB every morning)

const TG_BOT_TOKEN  = process.env.TG_BOT_TOKEN;
const TG_CHANNEL_ID = process.env.TG_CHANNEL_ID;
const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID;
const CG_KEY        = process.env.CG_KEY || 'CG-LUGa4vpkw7FgUiQ3wyGWaeVp';
const GNEWS_KEY     = process.env.GNEWS_KEY || '204f00771794b2f674c4f2e4a924623d';
const BROADCAST_KEY = process.env.BROADCAST_SECRET || 'cs-broadcast-secret';
const CRON_SECRET   = process.env.CRON_SECRET || 'cs-cron-secret';
const SITE_URL      = process.env.SITE_URL || 'https://cryptosignal.id';

async function fetchAllData() {
  const [pricesRes, globalRes, fngRes, trendingRes, newsRes] = await Promise.allSettled([
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin,ripple&vs_currencies=usd&include_24hr_change=true&x_cg_demo_api_key=${CG_KEY}`, { signal: AbortSignal.timeout(10000) }),
    fetch(`https://api.coingecko.com/api/v3/global?x_cg_demo_api_key=${CG_KEY}`, { signal: AbortSignal.timeout(10000) }),
    fetch('https://api.alternative.me/fng/?limit=2&format=json', { signal: AbortSignal.timeout(8000) }),
    fetch(`https://api.coingecko.com/api/v3/search/trending?x_cg_demo_api_key=${CG_KEY}`, { signal: AbortSignal.timeout(10000) }),
    fetch(`https://gnews.io/api/v4/search?q=bitcoin+crypto&lang=en&max=3&sortby=publishedAt&apikey=${GNEWS_KEY}`, { signal: AbortSignal.timeout(10000) }),
  ]);
  return {
    prices:   pricesRes.status==='fulfilled'   && pricesRes.value.ok   ? await pricesRes.value.json()           : {},
    global:   globalRes.status==='fulfilled'   && globalRes.value.ok   ? (await globalRes.value.json()).data    : {},
    fng:      fngRes.status==='fulfilled'      && fngRes.value.ok      ? (await fngRes.value.json()).data       : [],
    trending: trendingRes.status==='fulfilled' && trendingRes.value.ok ? (await trendingRes.value.json()).coins?.slice(0,5).map(c=>c.item) : [],
    news:     newsRes.status==='fulfilled'     && newsRes.value.ok     ? (await newsRes.value.json()).articles?.slice(0,3) || [] : [],
  };
}

const fmtUSD  = n => n>=1000 ? '$'+n.toLocaleString('en-US',{maximumFractionDigits:0}) : '$'+n?.toFixed(2);
const fmtPct  = n => (n>=0?'▲ +':'▼ ')+Math.abs(n).toFixed(2)+'%';
const fmtCap  = n => n>=1e12 ? '$'+(n/1e12).toFixed(2)+'T' : '$'+(n/1e9).toFixed(1)+'B';
const fmtDate = () => new Date().toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Jakarta'});
const fmtTime = () => new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'})+' WIB';

async function tgSend(chatId, text) {
  if (!chatId || !TG_BOT_TOKEN) return false;
  const chunks = [];
  for (let i = 0; i < text.length; i += 3800) chunks.push(text.slice(i, i+3800));
  for (const chunk of chunks) {
    await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: 'Markdown', disable_web_page_preview: true }),
    }).catch(e => console.error('TG error:', e.message));
    await new Promise(r => setTimeout(r, 600));
  }
  return true;
}

function buildContent(data) {
  const { prices, global, fng, trending, news } = data;
  const btc = prices.bitcoin    || {};
  const eth = prices.ethereum   || {};
  const sol = prices.solana     || {};
  const bnb = prices.binancecoin|| {};
  const xrp = prices.ripple     || {};

  const fngScore = parseInt(fng[0]?.value || 50);
  const fngLabel = fng[0]?.value_classification || 'Neutral';
  const fngPrev  = parseInt(fng[1]?.value || fngScore);
  const fngDiff  = fngScore - fngPrev;
  const fngEmoji = fngScore<=20?'😱':fngScore<=40?'😨':fngScore<=60?'😐':fngScore<=80?'😏':'🤑';
  const fngArrow = fngDiff>0?'↑':fngDiff<0?'↓':'→';
  const capChg   = global.market_cap_change_percentage_24h_usd || 0;
  const totalCap = fmtCap(global.total_market_cap?.usd || 0);
  const btcDom   = (global.market_cap_percentage?.btc || 0).toFixed(1);
  const mktEmoji = capChg >= 0 ? '🟢' : '🔴';
  const date = fmtDate();
  const time = fmtTime();

  const t1 = trending[0]?.symbol?.toUpperCase() || 'BTC';
  const t2 = trending[1]?.symbol?.toUpperCase() || 'ETH';
  const t3 = trending[2]?.symbol?.toUpperCase() || 'SOL';
  const tn1 = trending[0]?.name || 'Bitcoin';
  const tn2 = trending[1]?.name || 'Ethereum';
  const tn3 = trending[2]?.name || 'Solana';

  const fngInsight = fngScore<=20 ? '🎯 Extreme Fear = zona akumulasi smart money. Historis: peluang beli terbaik.'
    : fngScore<=40 ? '📌 Fear zone = pasar oversold. Watch for reversal signal.'
    : fngScore<=60 ? '⏳ Neutral = belum ada arah jelas. Tunggu konfirmasi.'
    : fngScore<=80 ? '⚠️ Greed zone = momentum ada tapi jaga risiko.'
    : '🚨 Extreme Greed = potensi koreksi besar. Mulai ambil profit.';

  const song = fngScore < 50
    ? `🎵 Today's mood: _"Blood in the Streets"_ — fear zone active`
    : `🎵 Today's mood: _"Everyone's a Genius"_ — greed zone active`;

  const channelCard =
`📊 *CRYPTOSIGNAL DAILY BRIEF*
${date} | ${time}

💰 *HARGA SEKARANG*
\`₿ BTC  ${btc.usd?fmtUSD(btc.usd):'—'}  ${btc.usd_24h_change?fmtPct(btc.usd_24h_change):''}\`
\`Ξ ETH  ${eth.usd?fmtUSD(eth.usd):'—'}  ${eth.usd_24h_change?fmtPct(eth.usd_24h_change):''}\`
\`◎ SOL  ${sol.usd?fmtUSD(sol.usd):'—'}  ${sol.usd_24h_change?fmtPct(sol.usd_24h_change):''}\`
\`◈ BNB  ${bnb.usd?fmtUSD(bnb.usd):'—'}  ${bnb.usd_24h_change?fmtPct(bnb.usd_24h_change):''}\`

${fngEmoji} *Fear & Greed: ${fngScore}/100 — ${fngLabel}*
${fngArrow} ${Math.abs(fngDiff)} poin dari kemarin
${fngInsight}

${mktEmoji} Market Cap: *${totalCap}* (${capChg>=0?'+':''}${capChg.toFixed(1)}%)
📈 BTC Dominance: *${btcDom}%*
🔥 Trending: $${t1} · $${t2} · $${t3}

${song}

🔗 [Signal live](${SITE_URL}) · [Upgrade Pro](${SITE_URL}/pro.html)`;

  const tiktok =
`🎬 *TIKTOK — 13 DETIK*
━━━━━━━━━━━━━━━━

*[0-2s]* "CRYPTO UPDATE ${date}"
*[2-5s]* "BTC ${btc.usd?fmtUSD(btc.usd):'—'} ${btc.usd_24h_change?'('+fmtPct(btc.usd_24h_change)+')':''}"
*[5-8s]* "Fear & Greed: ${fngScore}/100 ${fngEmoji} — ${fngScore<=40?'Zona fear = peluang!':fngScore>=60?'Zona greed = hati-hati!':'Tunggu arah!'}"
*[8-11s]* "Trending: #${t1} #${t2} #${t3}"
*[11-13s]* "cryptosignal.id — signal tiap 90 detik!"

📋 *CAPTION — copy paste:*

🚨 CRYPTO UPDATE ${date}
₿ BTC: ${btc.usd?fmtUSD(btc.usd):'—'} ${btc.usd_24h_change?fmtPct(btc.usd_24h_change):''}
${fngEmoji} Fear & Greed: ${fngScore}/100 (${fngLabel})
${mktEmoji} Market: ${capChg>=0?'+':''}${capChg.toFixed(1)}% 24h
🔥 Trending: #${t1} #${t2} #${t3}
${fngInsight}
📊 Signal live → cryptosignal.id
⚡ Alert Telegram Pro → cryptosignal.id/pro.html
#crypto #bitcoin #kripto #bitcoinindonesia #kriptoindonesia #investasikripto #altcoin #tradingcrypto #cryptosignal #fearandgreed #${t1.toLowerCase()} #${t2.toLowerCase()} #${t3.toLowerCase()}`;

  const youtube =
`🎬 *YOUTUBE SHORTS — 30 DETIK*
━━━━━━━━━━━━━━━━

*[0-3s]* "Crypto naik atau turun hari ini? 30 detik saya kasih tahu!"
*[3-8s]* "Market cap crypto ${totalCap}, ${capChg>=0?'naik':'turun'} ${Math.abs(capChg).toFixed(1)}% dalam 24 jam. BTC dominance ${btcDom}%."
*[8-14s]* "Bitcoin di ${btc.usd?fmtUSD(btc.usd):'—'} (${btc.usd_24h_change?fmtPct(btc.usd_24h_change):'—'}). ETH ${eth.usd?fmtUSD(eth.usd):'—'}, SOL ${sol.usd?fmtUSD(sol.usd):'—'}."
*[14-20s]* "Fear & Greed ${fngScore} — ${fngLabel}. ${fngScore<=35?'Zona fear = historis waktu akumulasi!':fngScore>=65?'Zona greed = potensi koreksi!':'Netral, tunggu arah.'}"
*[20-25s]* "Trending: ${tn1}, ${tn2}, ${tn3}. Pantau gerakannya!"
*[25-28s]* "${news[0]?.title?.substring(0,70) || 'Pasar crypto aktif hari ini'}..."
*[28-30s]* "Signal live tiap 90 detik di cryptosignal.id. Link di deskripsi!"

📋 *DESCRIPTION — copy paste:*

🚨 CRYPTO ${date} | BTC ${btc.usd?fmtUSD(btc.usd):'—'} | F&G ${fngScore}
• BTC: ${btc.usd?fmtUSD(btc.usd):'—'} (${btc.usd_24h_change?fmtPct(btc.usd_24h_change):'—'})
• ETH: ${eth.usd?fmtUSD(eth.usd):'—'} (${eth.usd_24h_change?fmtPct(eth.usd_24h_change):'—'})
• SOL: ${sol.usd?fmtUSD(sol.usd):'—'} (${sol.usd_24h_change?fmtPct(sol.usd_24h_change):'—'})
• Fear & Greed: ${fngScore}/100 (${fngLabel})
• Market Cap: ${totalCap} (${capChg>=0?'+':''}${capChg.toFixed(1)}%)
• Trending: ${t1}, ${t2}, ${t3}
📊 ${SITE_URL} | ⚡ ${SITE_URL}/pro.html
#crypto #bitcoin #kripto #kriptoindonesia #tradingcrypto #cryptosignal`;

  const instagram =
`📸 *INSTAGRAM — copy paste:*

📊 CRYPTO MORNING BRIEF
${date} • ${time}
━━━━━━━━━━━━━━━━━━━━━
💰 HARGA SEKARANG
₿ BTC   ${btc.usd?fmtUSD(btc.usd):'—'}   ${btc.usd_24h_change?fmtPct(btc.usd_24h_change):''}
Ξ ETH   ${eth.usd?fmtUSD(eth.usd):'—'}   ${eth.usd_24h_change?fmtPct(eth.usd_24h_change):''}
◎ SOL   ${sol.usd?fmtUSD(sol.usd):'—'}   ${sol.usd_24h_change?fmtPct(sol.usd_24h_change):''}
◈ BNB   ${bnb.usd?fmtUSD(bnb.usd):'—'}   ${bnb.usd_24h_change?fmtPct(bnb.usd_24h_change):''}
✦ XRP   ${xrp.usd?fmtUSD(xrp.usd):'—'}   ${xrp.usd_24h_change?fmtPct(xrp.usd_24h_change):''}

${fngEmoji} SENTIMEN: ${fngScore}/100 — ${fngLabel}
${fngInsight}
${mktEmoji} Market Cap: ${totalCap} (${capChg>=0?'+':''}${capChg.toFixed(1)}%)

🔥 TRENDING:
${trending.slice(0,5).map((t,i)=>`${i+1}. ${t.name} ($${t.symbol?.toUpperCase()})`).join('\n')}

📰 NEWS:
${news.slice(0,2).map((n,i)=>`${i+1}. ${n.title?.substring(0,80)}...`).join('\n')}
━━━━━━━━━━━━━━━━━━━━━
📲 cryptosignal.id | ⚡ Pro Rp 449K/bln
#crypto #bitcoin #ethereum #kripto #bitcoinindonesia #kriptoindonesia #investasikripto #altcoin #defi #blockchain #tradingcrypto #cryptosignal #fearandgreed #${t1.toLowerCase()} #${t2.toLowerCase()} #${t3.toLowerCase()} #marketupdate`;

  const twitter =
`🐦 *TWITTER/X THREAD — copy paste:*

*1/4:*
🧵 CRYPTO BRIEF ${date}
₿ BTC: ${btc.usd?fmtUSD(btc.usd):'—'} ${btc.usd_24h_change?fmtPct(btc.usd_24h_change):''}
${fngEmoji} Fear & Greed: ${fngScore} — ${fngLabel}
${mktEmoji} Market: ${totalCap} (${capChg>=0?'+':''}${capChg.toFixed(1)}%)

*2/4:*
${fngEmoji} F&G INDEX: ${fngScore}/100
${fngScore<=20?'EXTREME FEAR — smart money akumulasi':fngScore<=40?'FEAR — watch reversal':fngScore<=60?'NEUTRAL — tunggu konfirmasi':fngScore<=80?'GREED — manage risiko':'EXTREME GREED — potensi koreksi'}
${fngInsight}

*3/4:*
🔥 TRENDING
${trending.slice(0,5).map((t,i)=>`${i+1}. $${t.symbol?.toUpperCase()} (${t.name})`).join('\n')}
Trending sering mendahului price action 24-48 jam!

*4/4:*
📰 NEWS
${news.slice(0,2).map(n=>`• ${n.title?.substring(0,100)}`).join('\n')}
Signal live → ${SITE_URL} ⚡
#Bitcoin #Crypto #Kripto #CryptoSignal #${t1} #${t2}`;

  return { channelCard, tiktok, youtube, instagram, twitter };
}

export default async function handler(req, res) {
  // Auth: allow Vercel cron (has x-vercel-cron-secret header) OR manual with ?secret=
  const isVercelCron = !!req.headers['x-vercel-cron-secret'];
  const isManual = req.query.secret === CRON_SECRET;
  if (!isVercelCron && !isManual) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    console.log('Morning brief starting:', new Date().toISOString());
    console.log('Config check - TG_BOT_TOKEN:', TG_BOT_TOKEN ? 'SET' : 'MISSING');
    console.log('Config check - OWNER_CHAT_ID:', OWNER_CHAT_ID ? OWNER_CHAT_ID : 'MISSING');
    console.log('Config check - TG_CHANNEL_ID:', TG_CHANNEL_ID ? TG_CHANNEL_ID : 'MISSING');
    const data = await fetchAllData();
    const { channelCard, tiktok, youtube, instagram, twitter } = buildContent(data);
    const results = { channel: false, owner: false, broadcast: null };

    if (TG_CHANNEL_ID) {
      results.channel = await tgSend(TG_CHANNEL_ID, channelCard);
    }

    if (OWNER_CHAT_ID) {
      const hdr = `🎬 *CONTENT PACKAGE — ${new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Jakarta'})}*\n━━━━━━━━━━━━━━━━━━━━━\nSemua konten siap copy-paste ⬇️`;
      await tgSend(OWNER_CHAT_ID, hdr);
      await tgSend(OWNER_CHAT_ID, tiktok);
      await tgSend(OWNER_CHAT_ID, youtube);
      await tgSend(OWNER_CHAT_ID, instagram);
      await tgSend(OWNER_CHAT_ID, twitter);
      results.owner = true;
    }

    try {
      const br = await fetch(`${SITE_URL}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-broadcast-key': BROADCAST_KEY },
        body: JSON.stringify({ message: channelCard, signalType: 'neutral', impact: 60, source: 'CryptoSignal Daily' }),
      });
      results.broadcast = await br.json().catch(() => null);
    } catch (e) { console.error('Broadcast error:', e.message); }

    console.log('Done:', JSON.stringify(results));
    return res.status(200).json({ ok: true, results, timestamp: new Date().toISOString() });

  } catch (err) {
    console.error('Morning brief error:', err.message);
    // Send error alert to owner via Telegram so we know immediately if it fails
    if (OWNER_CHAT_ID && TG_BOT_TOKEN) {
      await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: OWNER_CHAT_ID,
          text: `🚨 *CryptoSignal Morning Brief FAILED*

Error: ${err.message}
Time: ${new Date().toISOString()}

Manual fix: cryptosignal.id/api/morning-brief?secret=cs-cron-secret`,
          parse_mode: 'Markdown'
        })
      }).catch(() => {});
    }
    return res.status(500).json({ ok: false, message: err.message });
  }
}
