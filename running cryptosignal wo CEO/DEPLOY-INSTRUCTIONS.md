# CryptoSignal.id — Hostinger Deployment Guide

## Files to upload to Hostinger (public_html folder)

Upload these 2 files directly into your `public_html` folder:
- index.html       → cryptosignal.id (main live feed)
- alerts.html      → cryptosignal.id/alerts.html (alert center)

---

## Step-by-Step Hostinger Upload

1. Log in to hPanel at hpanel.hostinger.com
2. Go to: Hosting → Manage → File Manager
3. Open the `public_html` folder
4. Upload both files (drag & drop or use Upload button)
5. Done — visit https://cryptosignal.id

---

## What Goes Live Immediately

### Live Data (no server needed — all client-side):
✅ Real crypto prices — CoinGecko API (refreshes every 60s)
✅ Live news feed — NewsAPI (refreshes every 90s)
✅ AI signal classification (break/bull/bear/whale/reg)
✅ Market impact scoring per article
✅ Source trust scoring
✅ Telegram alerts for breaking news (auto-sends to your chat ID)
✅ Alert preferences saved in browser localStorage
✅ Test Telegram button on alerts.html

### Telegram Bot is LIVE:
- Bot Token: 8725389396:AAE7ZsiruPDNX4ljGId88UGjOHjMh5GYTJc
- Chat ID: 211783030
- Breaking news (impact ≥75) auto-sends to your Telegram
- Test it from alerts.html → "Test Telegram" button

---

## API Keys In Use
- CoinGecko: CG-LUGa4vpkw7FgUiQ3wyGWaeVp (free demo tier)
- NewsAPI: d7096f127fbf4369a25ab7fe460f212d (free: 100 req/day, dev mode)
- Telegram Bot: configured and live

---

## NewsAPI Note
NewsAPI free plan restricts to localhost & development only.
For production (cryptosignal.id), upgrade to:
  → newsapi.org/pricing → Developer $449/yr OR use a CORS proxy

### Quick CORS proxy fix (paste in index.html line with NEWSAPI url):
Replace: https://newsapi.org/v2/everything?...
With:    https://api.allorigins.win/get?url=encodeURIComponent("https://newsapi.org/v2/everything?...")

OR sign up for free alternatives:
- GNews API: gnews.io (free 100/day, no CORS issue)  
- Currents API: currentsapi.services (free 600/day)
- MediaStack: mediastack.com (free 500/month)

---

## Optional: Custom Domain Email for Alerts
Set up in Hostinger → Email → Create: alerts@cryptosignal.id

---

## Next Steps After Upload
1. Upload files to public_html
2. Visit cryptosignal.id — prices & news load live
3. Go to /alerts.html → click "Test Telegram" to confirm bot works
4. Swap NewsAPI for GNews if CORS blocks in production
