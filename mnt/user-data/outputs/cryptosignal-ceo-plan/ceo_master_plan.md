# CryptoSignal.id — CEO Agent Master Plan
**Compiled by: CEO Agent (Claude Orchestrator)**
**Date: April 28, 2026**
**Classification: Internal Strategic Document**

---

## Executive Summary

CryptoSignal.id is positioned to become Southeast Asia's premier real-time crypto intelligence platform — a Bloomberg Terminal for the masses, built at a fraction of the cost. Our unfair advantages: 15+ live data sources aggregated with AI scoring, DOKU-powered IDR payments, Telegram push alerts, and a free-tier funnel with clear monetization rails.

This document is the CEO's single source of truth. All five agents execute against this plan.

---

## Mental Model Stack (Applied Thinking Frameworks)

| Thinker | Applied Insight |
|---|---|
| Warren Buffett | Moat = data aggregation speed + trust scoring. Every free user is a future Pro subscriber. Compound loyalty. |
| Charlie Munger | Invert: what kills us? Rate limits + payment friction. Fix those first. Everything else is growth. |
| Elon Musk | First principles: the app doesn't need 100 features. It needs 3 things that work perfectly: signals, alerts, payments. |
| Mark Zuckerberg | Growth loops: free tier → email capture → paywall → referral. Every screen is a conversion funnel. |
| Jack Ma | B2B is underpriced. One enterprise sale = 6x Pro revenue. Indonesia crypto funds are the beachhead. |
| Ma Huateng (Tencent) | Ecosystem play: add affiliate trading links. Every signal card becomes a revenue touchpoint. |
| Sam Altman | Ship fast, iterate on user feedback. Launch annual plan before monthly saturates. |
| Jeff Bezos | Customer obsession: Pro user gets welcome TG, alert history, and concierge onboarding. Every touch point matters. |
| Sir Richard Branson | Brand personality: CryptoSignal isn't a tool, it's an intelligence edge. Make the brand feel elite. |

---

## Priority Stack — CEO Decision

### 🔴 CRITICAL (Fix This Week — Blocking Revenue)

| # | Issue | Impact | Owner |
|---|---|---|---|
| 1 | GNews 429 rate limit (8→3 queries) | 100% of users see broken feed | Agent 2 |
| 2 | DOKU webhook URL not confirmed | 0% payment-to-Pro conversion | Agent 2 + Manual |
| 3 | Payment end-to-end test | Unknown if revenue works at all | Agent 2 |

### 🟡 HIGH (This Month — Product Quality)

| # | Issue | Impact | Owner |
|---|---|---|---|
| 4 | Alerts page empty for Pro users | Pro value prop broken | Agent 2+3 |
| 5 | Pro re-verification on new device | Churn from friction | Agent 2 |
| 6 | AI classifier uses random scores | Trust credibility broken | Agent 2 |
| 7 | Mobile responsive stats bar | 60%+ traffic on mobile | Agent 3 |

### 🟢 GROWTH (Next 30 Days)

| # | Feature | Revenue Potential | Owner |
|---|---|---|---|
| 8 | SEO landing page at / | Organic Google traffic | Agent 3+4 |
| 9 | Social proof + subscriber count | +15-20% conversion | Agent 3 |
| 10 | Referral system | Zero-cost user acquisition | Agent 2 |
| 11 | B2B API tier outreach | Rp 3jt/month per client | Agent 4 |
| 12 | TikTok/IG auto-posting | Free daily traffic | Agent 4 |

### 🔵 MONETIZATION (Next 60 Days)

| # | Feature | Revenue Potential | Owner |
|---|---|---|---|
| 13 | Annual plan Rp 3.9jt/year | Cash upfront + low churn | Agent 2+3 |
| 14 | Email capture at paywall | Mailing list for drip conversion | Agent 2 |
| 15 | Crypto exchange affiliate | Passive commission per signup | Agent 4 |

---

## Agent Assignments

### Agent 1 — CEO (This Document)
- Owns all strategic decisions
- Reviews all agent outputs
- Decides what to ship vs. defer
- 1% founder involvement required

### Agent 2 — Engineering
**Sprint 1 (Days 1-3):**
- [ ] Deploy new index.html with 3-query GNews fix
- [ ] Confirm DOKU webhook URL in dashboard
- [ ] Run payment end-to-end test (Rp 449K → TG welcome → Redis → Pro badge)
- [ ] Fix AI classifier: replace random with keyword-weight sentiment scoring

**Sprint 2 (Days 4-10):**
- [ ] Build Pro verification flow (email lookup on new device)
- [ ] Add referral system (unique referral links, 1-month-free reward)
- [ ] Add annual plan (Rp 3.9jt/year) to create-payment.js and pro.html
- [ ] Email capture at paywall (localStorage email → mailing list API)
- [ ] Mobile responsive fix for stats bar (CSS grid → auto-fit)

### Agent 3 — Frontend/Design
**Sprint 1 (Days 1-5):**
- [ ] SEO landing page at / (move app to /feed)
- [ ] Rebuild alerts.html for Pro users (alert history + signal preferences)
- [ ] Mobile responsive pass (stats bar, sidebar, signal cards)
- [ ] Social proof section in pro.html (subscriber count + testimonials)

**Sprint 2 (Days 6-14):**
- [ ] Prepare iOS App Store screenshots (6.5" iPhone, 13" iPad)
- [ ] Prepare Android Play Store assets (feature graphic, screenshots)
- [ ] Canva designs: social media templates for TikTok/IG/YouTube
- [ ] Brand refresh: make the brand feel premium/elite

### Agent 4 — Marketing
**Ongoing:**
- [ ] TikTok/IG/YouTube auto-posting pipeline (top 3 daily signals as video)
- [ ] B2B outreach emails (10 Indonesian crypto traders/funds)
- [ ] Affiliate registration (Pintu, Tokocrypto, Indodax)
- [ ] SEO content strategy (target: "crypto signals Indonesia", "crypto alert telegram")
- [ ] Social media calendar (daily, weekly themes)

### Agent 5 — Customer Service
**Setup:**
- [ ] Gmail monitoring for app registration, domain, social media
- [ ] AI chatbot for Pro user support (Telegram bot)
- [ ] Privacy policy and terms of service pages
- [ ] Analytics setup (Google Analytics + Vercel Analytics)
- [ ] Documentation for Pro users (onboarding guide)

---

## Revenue Model

| Tier | Price | Target Users | Monthly ARR |
|---|---|---|---|
| Free | Rp 0 | 10,000 | — |
| Pro Monthly | Rp 449K | 500 | Rp 224.5jt |
| Pro Annual | Rp 3.9jt | 200 | Rp 780jt |
| Business API | Rp 3jt/mo | 10 | Rp 30jt |
| **Total** | | | **~Rp 1 Milyar/year** |

---

## Tech Stack Health Check

| Component | Status | Action |
|---|---|---|
| Vercel hosting | ✅ Live | — |
| GNews API | ⚠️ 429 rate limit | Fix: 3 queries max |
| DOKU Checkout | ⚠️ Webhook unconfirmed | Confirm dashboard |
| Redis (Upstash) | ✅ Working | — |
| Telegram Bot | ✅ Working | — |
| CoinGecko API | ✅ Free tier OK | — |
| Fear & Greed | ✅ Free, no key | — |
| allorigins proxy | ✅ Working for RSS | — |

---

## 90-Day Milestones

| Day | Milestone |
|---|---|
| 7 | All critical fixes deployed. Payment end-to-end verified. |
| 14 | SEO landing page live. Alerts page rebuilt. Mobile responsive. |
| 21 | Annual plan live. Referral system active. Social posting running. |
| 30 | 50 Pro subscribers. B2B first outreach sent. |
| 60 | iOS App Store submitted. 150 Pro subscribers. |
| 90 | 300+ Pro subscribers. First B2B client. Affiliate revenue flowing. |

---

*This document is updated by the CEO Agent after each sprint. Founder reviews weekly.*
