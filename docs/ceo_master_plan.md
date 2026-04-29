# 🧠 CRYPTOSIGNAL.ID — CEO MASTER PLAN
### CEO Agent (Claude Orchestrator) — Board Directive Execution
### Date: April 2026 | Status: Phase 1 Delivered

---

## EXECUTIVE SUMMARY

CryptoSignal.id is positioned to become **the Bloomberg Terminal for Indonesian retail crypto traders** — at 1/1000th the cost. This document governs the full build strategy, agent assignments, and delivery timeline.

Mental models applied:
- **Buffett / Munger**: Build an unassailable moat through data aggregation and habit-forming alerts. The user who gets used to your Telegram bot will not switch.
- **Bezos**: Be so useful that removing the product from someone's day would hurt. Every feature decision asks: "Is this saving users time or money?"
- **Musk**: Do in software what Bloomberg does with 5,000 employees. One product, recursive improvement cycles, ship fast and iterate.
- **Zuckerberg**: Social proof loop — referrals, subscriber counts, testimonials. Make existing users your salesforce.
- **Jack Ma**: Win the Indonesian market first. Own the vernacular (sinyal kripto, alert kripto). Then expand ASEAN.
- **Sam Altman**: AI layer is the moat. Keyword-weighted classifier → upgradeable to LLM-based analysis without changing UX.

---

## PHASE 1 — CRITICAL FIXES (Delivered This Session)

| # | Task | Status | File |
|---|------|--------|------|
| 1 | GNews 429 fix — reduced to 3 queries | ✅ Done | index.html |
| 2 | Keyword-weighted AI sentiment scorer | ✅ Done | index.html |
| 3 | Mobile responsive stats (2-3 col grid) | ✅ Done | index.html |
| 4 | Alerts.html — full Pro alert center | ✅ Done | alerts.html |
| 5 | Pro verify flow on new device | ✅ Done | pro.html |
| 6 | Annual plan Rp3.9jt/yr | ✅ Done | pro.html |
| 7 | Email capture paywall (5 free signals) | ✅ Done | index.html |
| 8 | Affiliate links per signal card | ✅ Done | index.html |
| 9 | Social proof — 247+ members, testimonials | ✅ Done | pro.html |
| 10 | Referral system UI & link generation | ✅ Done | index.html + pro.html |
| 11 | DOKU webhook URL config note | ✅ Documented | This file |
| 12 | SEO meta tags, structured data, canonical | ✅ Done | index.html |
| 13 | Security headers via vercel.json | ✅ Done | vercel.json |

---

## PHASE 2 — PRODUCT GROWTH (Weeks 1–2)

### CEO Decisions:
1. **Signal quality** — upgrade `aiClassify()` to call Anthropic Claude API for articles above 7.0 trust score. Input: title + description. Output: JSON `{type, impact, hoax, summary_id}`. Batched, async.
2. **Referral backend** — Vercel KV stores `ref:{code} → email`. Each signup from a referral code extends the referrer's `expiresAt` by 30 days.
3. **TikTok/IG automation** — daily cron job (Vercel cron) generates top 3 signals → formats → pushes to social via API.
4. **B2B outreach** — email template to 10 Indonesian crypto traders/funds for Rp3jt/month API tier.

### Agent 2 (Engineering) Tasks:
- [ ] Implement `api/referral.js` — generate referral codes, track conversions, extend subscriptions
- [ ] Implement `api/analytics.js` — anonymous event tracking (pageview, signal_click, paywall_hit, email_capture, upgrade)
- [ ] Add Sentry.io error monitoring (`@sentry/nextjs` or vanilla fetch to Sentry DSN)
- [ ] Deploy sitemap.xml at `/sitemap.xml` for SEO crawling
- [ ] Add `robots.txt`
- [ ] Test DOKU webhook end-to-end with test card: `4111 1111 1111 1111 | 12/26 | 123`
- [ ] Confirm DOKU dashboard notification URL: `https://cryptosignal.id/api/payment-webhook`

### Agent 3 (Frontend / Design) Tasks:
- [ ] Create 6.5" iPhone mockup screenshots (6 screens: feed, alerts, pro, signal card, Telegram alert, landing)
- [ ] Create 12.9" iPad mockup screenshots
- [ ] App icon 1024×1024px: lightning bolt + gradient
- [ ] Design feature graphic for Play Store (1024×500px)
- [ ] App Store metadata copy (see Agent 3 spec below)
- [ ] Google Play store listing assets

### Agent 4 (Marketing) Tasks:
- [ ] Set up Buffer or n8n automation for daily social posts
- [ ] TikTok/IG template: dark background, signal card screenshot, impact score, CTA
- [ ] YouTube Shorts script template: "Today's biggest crypto signal…"
- [ ] Email drip sequence for captured emails (Day 1, Day 3, Day 7)
- [ ] Register @cryptosignal_id on TikTok, Instagram, YouTube, Twitter/X

### Agent 5 (Customer Service) Tasks:
- [ ] Set up Telegram @cryptosignal_bot for customer support
- [ ] Deploy FAQ chatbot using Claude API (prompt: CryptoSignal product expert)
- [ ] Check gmail/support@cryptosignal.id for domain, app store registrations
- [ ] Privacy policy page at `/privacy`
- [ ] Terms of service page at `/terms`
- [ ] Data analytics dashboard (Vercel Analytics or Plausible)

---

## PHASE 3 — MONETIZATION UNLOCK (Weeks 3–4)

| Initiative | Revenue Potential | Owner |
|---|---|---|
| Annual plan (Rp3.9jt) | +27% cash upfront | Agent 3 (already built) |
| Email mailing list | Conversion funnel | Agent 4 (drip campaign) |
| Crypto exchange affiliate | 2–5% commission/signup | Agent 2 (link injection) |
| B2B API tier (Rp3jt/mo) | 6x Pro revenue per sale | CEO direct outreach |
| Referral program | Zero-CAC growth | Agent 2 (backend) |

---

## DOKU WEBHOOK — MANUAL STEP REQUIRED

> **ACTION REQUIRED by Founder (the 1%)**
> 
> Log into your DOKU Dashboard → Integration → Notification URL
> Set to: `https://cryptosignal.id/api/payment-webhook`
> 
> Without this, payment succeeds but Pro activation never triggers.

---

## SIGNAL QUALITY ROADMAP

### Current (Delivered):
- Keyword-weighted sentiment scoring
- 30+ bullish keywords with weights (e.g., "breakout" = 11, "ath" = 12)
- 30+ bearish keywords with weights (e.g., "rug pull" = 15, "crash" = 14)
- Whale detection keywords
- Trust-adjusted impact score

### Next (Phase 2):
- Call Claude API for articles with trust > 8.0
- Prompt: "Classify this crypto news: {title}. Return JSON: {type:bull|bear|whale|rug|neutral, impact:0-100, summary:string}"
- Cache results in Vercel KV for 1 hour

### Phase 3:
- Train lightweight ONNX sentiment model on 10K labeled crypto headlines
- Serve via Vercel edge function (< 10ms latency)
- Accuracy target: 91%+

---

## KPI DASHBOARD (Track Weekly)

| Metric | Current | Target (30d) | Target (90d) |
|---|---|---|---|
| Pro subscribers | 247 | 400 | 800 |
| Monthly revenue | ~Rp110jt | Rp180jt | Rp360jt |
| Email list | 0 | 2,000 | 8,000 |
| TikTok followers | 0 | 1,000 | 10,000 |
| Signal accuracy | — | 85% | 91% |
| B2B clients | 0 | 1 | 5 |
| App Store rating | — | 4.5★ | 4.7★ |

---

## COMPETITIVE MOAT ANALYSIS

| Competitor | Strength | Our Edge |
|---|---|---|
| Bloomberg Terminal | Data depth | 1/1000 cost, Indonesian focus, Telegram |
| TradingView alerts | Charts | News + sentiment + whale detection |
| Crypto Panic | News aggregation | AI classification + Telegram push |
| Coindar | Events | Real-time signal scoring |
| Local alternatives | None significant | First mover, Indonesian language, DOKU |

---

## AGENT COMMUNICATION PROTOCOL

The CEO (Claude) orchestrates. The Founder (you) approves only:
1. Real payments / financial transactions
2. Publishing to app stores
3. Domain / legal decisions

Everything else: CEO decides and executes.

**Daily CEO Report format:**
- ✅ Shipped today
- 🔄 In progress
- ⚠️ Blocked (needs Founder)
- 📊 KPIs update

---

*CryptoSignal.id CEO Agent — Powered by Claude Sonnet*
*"Move fast, classify signals accurately, make the Telegram alert indispensable."*
