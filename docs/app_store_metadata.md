# CryptoSignal.id — App Store Metadata
## Ready to Paste into App Store Connect

---

## APP NAME (30 chars max)
CryptoSignal: AI Crypto Alerts

## SUBTITLE (30 chars max)
Real-Time Signals & Telegram Push

---

## DESCRIPTION (4000 chars max)

CryptoSignal.id is the fastest crypto intelligence platform for Indonesian traders — powered by AI, delivering breaking signals from 15+ live sources directly to your Telegram.

**WHY CRYPTOSIGNAL?**

While other apps give you yesterday's news, CryptoSignal classifies every signal the moment it breaks — bullish, bearish, whale movement, or rug alert — and pushes it to your Telegram in under 60 seconds.

**15+ LIVE SOURCES IN ONE FEED**
• CoinDesk, CoinTelegraph, The Block, Decrypt
• Whale Alert Telegram, Wu Blockchain, CoinDesk TG
• Reddit r/Bitcoin & r/CryptoCurrency
• Fear & Greed Index (Alternative.me)
• CoinGecko Trending Coins & Global Market
• Mempool.space BTC network activity
• DexScreener DEX trending tokens
• Binance Official Announcements
• Truth Social — Presidential market posts
• GNews — 80+ mainstream crypto outlets

**AI SIGNAL CLASSIFICATION**
Every article is scored by our keyword-weighted AI engine:
• Impact Score (0–100): How market-moving is this?
• Trust Score: Source credibility rating
• Hoax Score: Reliability indicator
• Signal Type: Bullish / Bearish / Whale / Rug Alert / Neutral

**TELEGRAM INSTANT ALERTS (Pro)**
Set your threshold. We push only what matters:
• Breaking news with Impact >75
• POTUS posts affecting crypto markets
• Fear & Greed extremes (<20 or >80)
• BTC whale mempool spikes
• Your custom coin watchlist alerts

**PLANS**
• Free: 20 signals per session, 5 sources
• Pro Monthly: Rp449.000/bulan — unlimited everything + Telegram
• Pro Annual: Rp3.900.000/tahun — best value, save 27%

Join 247+ Pro members who get the edge before the market moves.

---

## KEYWORDS (100 chars max)
crypto,signal,bitcoin,alert,telegram,BTC,ETH,trading,Indonesia,kripto,sinyal,blockchain,whale

---

## PROMOTIONAL TEXT (170 chars max)
⚡ New: Annual plan at Rp3.9jt/yr (save 27%). Real-time AI signals from 15+ sources. Telegram alerts in <60sec. Join 247+ Pro traders.

---

## SUPPORT URL
https://cryptosignal.id/support

## MARKETING URL  
https://cryptosignal.id

## PRIVACY POLICY URL
https://cryptosignal.id/privacy

---

## WHAT'S NEW (latest version)
• AI signal classifier: keyword-weighted scoring replaces random numbers
• Annual Pro plan: Rp3.9jt/year (save 27% vs monthly)
• Mobile responsive: stats bar now optimized for all screen sizes
• Alert Center: configure which signals push to Telegram
• Referral program: share your link, earn 1 free month per referral
• Affiliate signal links: trade signals directly on Tokocrypto/Pintu

---

## AGE RATING
17+ (Frequent/Intense Simulated Gambling, Infrequent/Mild Mature/Suggestive Themes)
Note: App contains cryptocurrency market information. Users should be aware of crypto investment risks.

---

## CATEGORY
Primary: Finance
Secondary: News

---

## QA CHECKLIST — 40+ Test Cases

### Core Functionality
- [ ] App loads within 3 seconds on 4G
- [ ] Signal feed populates within 10 seconds
- [ ] GNews: exactly 3 queries fired (check Network tab)
- [ ] No 429 errors from GNews in 10 consecutive refreshes
- [ ] Fear & Greed gauge animates correctly
- [ ] Trending coins bar populates with CoinGecko data
- [ ] Ticker scroll animation works and pauses on hover
- [ ] POTUS banner shows when Truth Social returns posts
- [ ] Stats counters update after fetch (bull/bear/whale counts)
- [ ] Refresh button manually triggers fetchAll()
- [ ] Auto-refresh fires every 90 seconds

### Paywall & Email Capture
- [ ] Free user sees exactly 20 signals before paywall
- [ ] Paywall email capture field accepts valid email
- [ ] After email submit: 25 signals now visible
- [ ] Invalid email shows validation error
- [ ] Pro user: no paywall shown
- [ ] localStorage 'cs_pro' = 'true' bypasses paywall

### Signal Classification
- [ ] Keyword "breakout" → type=bull
- [ ] Keyword "crash" → type=bear
- [ ] Keyword "whale" + "billion" → type=whale
- [ ] Keyword "rug pull" → type=rug
- [ ] No keywords → type=neutral
- [ ] Impact score is NOT random (same text = same score on reload)
- [ ] Trust score reflects source tier (CoinDesk = 9.3, unknown = 7.0)

### Filters & Search
- [ ] Bullish filter toggle hides/shows bull cards
- [ ] Bearish filter toggle works
- [ ] Whale filter works
- [ ] Coin filter: BTC shows only BTC signals
- [ ] DeFi filter: SOL/MATIC/LINK/UNI/AAVE signals
- [ ] Search filters by title text
- [ ] Search filters by source name
- [ ] Sort by Impact: highest impact card first
- [ ] Sort by Trust: highest trust card first
- [ ] Sort by Fresh: most recent first (default)

### Mobile (iOS-specific)
- [ ] Stats row: 2-column on iPhone SE (375px)
- [ ] Stats row: 3-column on iPhone 14 (390px)
- [ ] Sidebar hidden on mobile by default
- [ ] Hamburger button shows/hides sidebar
- [ ] Header prices hidden on mobile (clean header)
- [ ] Cards fully readable on 375px
- [ ] Signal score bars render correctly
- [ ] Paywall modal scrollable on small screen
- [ ] Email capture inline paywall works on touch

### iPad-specific
- [ ] Stats row: 5-column on iPad (768px+)
- [ ] Sidebar always visible on iPad
- [ ] Feed cards use full width on iPad

### Android-specific
- [ ] App wraps correctly in TWA (Trusted Web Activity)
- [ ] Digital Asset Links file accessible at /.well-known/assetlinks.json
- [ ] No horizontal scroll on any screen size

### Pro Flow
- [ ] Checkout modal opens on plan selection
- [ ] Email + name validation before payment init
- [ ] DOKU checkout window opens
- [ ] Polling every 5s for payment status
- [ ] Success state shown after payment
- [ ] localStorage 'cs_pro' set to 'true'
- [ ] Pro verify on new device: email → API → badge shown
- [ ] Annual plan amount = 3900000 IDR in payload

### Alerts Page
- [ ] Page loads without errors
- [ ] Signal type toggles work (on/off state)
- [ ] Impact threshold slider updates display value
- [ ] Trust threshold slider updates display value
- [ ] Add coin to watchlist
- [ ] Remove coin from watchlist
- [ ] Settings saved to localStorage
- [ ] Telegram Chat ID field accepts numbers
- [ ] Connect Telegram: API call to /api/payment-webhook?action=update-chatid
- [ ] Non-Pro user sees upgrade gate for Telegram section

### Performance
- [ ] Lighthouse Performance score > 85
- [ ] No render-blocking resources
- [ ] Total page weight < 500KB (excluding fonts)
- [ ] All images load with lazy attribute
- [ ] CSS animations use transform/opacity (no layout triggers)

### Accessibility
- [ ] All buttons have accessible labels
- [ ] Color contrast: muted text > 4.5:1 on dark background
- [ ] Focus ring visible on keyboard nav
- [ ] Screen reader: signal type announced correctly

### Security
- [ ] No API keys exposed in browser network tab (GNews key is in JS — flag for backend migration)
- [ ] X-Content-Type-Options header present
- [ ] X-Frame-Options: DENY header present
- [ ] HTTPS everywhere, no mixed content
