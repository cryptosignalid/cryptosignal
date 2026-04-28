# CryptoSignal Pro — Setup Guide
## Environment Variables (set in Vercel Dashboard → Settings → Environment Variables)

### REQUIRED — DOKU Payment Gateway
```
DOKU_CLIENT_ID=BRN-0280-1777102334281   # From dashboard.doku.com → My Apps
DOKU_SECRET_KEY=SK-QKbcPUHEiwGFsqws0Wts   # From dashboard.doku.com → My Apps  
DOKU_ENV=production                          # Change to "production" when ready
SITE_URL=https://cryptosignal.id
```

### REQUIRED — Telegram Bot
```
TG_BOT_TOKEN=1234567890:8655654640:AAHfFAIcocjEmfgrXiRYRka01UErcJPmZ60  # Your existing bot token
```

---

## DOKU Setup Steps

1. Register at https://dashboard.doku.com
2. Go to My Apps → Create New App
3. Copy Client ID and Secret Key
4. Set Notification URL to: https://cryptosignal.id/api/payment-webhook
5. Set Success URL to: https://cryptosignal.id/pro.html?status=success  
6. Set Failed URL to: https://cryptosignal.id/pro.html?status=failed

## Switch from Sandbox to Production
1. Change DOKU_ENV=production in Vercel env vars
2. Change the script tag in pro.html:
   FROM: https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js
   TO:   https://jokul.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js

## Update pro.html
In pro.html, update line:
  const TG_BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
With your actual bot token (this runs client-side for the activation message only)

## Files Deployed
- index.html     → main live feed
- pro.html       → pro upgrade page  
- alerts.html    → alerts center
- api/create-payment.js   → creates DOKU checkout session (server-side HMAC)
- api/payment-webhook.js  → receives DOKU payment notifications
- vercel.json    → routing config
