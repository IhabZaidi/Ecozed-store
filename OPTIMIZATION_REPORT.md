# Ecozed Store — Full Optimization Report
*Audit date: October 2026 · Status snapshot + prioritized action plan*

## 1. Where we stand (measured)

| Area | Current state |
|---|---|
| Landing LCP / FCP (Lighthouse, prod) | 1.7s / 0.8s ✅ |
| CLS | Was **1.069** (critical) → fixed: sized images, blur placeholders, seamless slices ✅ |
| Page weight | ~564 KB total, ~200 KB images (AVIF), Facebook libs 213 KB (required for ads) |
| Accessibility | 0.96 (contrast fixed) · Best practices / SEO 100 |
| Tracking | PageView (browser) + ViewContent / InitiateCheckout / Purchase (server CAPI), E.164 phone + city/state/country hashing, zero duplication by design |
| Orders | Server-side pricing/shipping, tamper-proof, validation matrix enforced |

## 2. Performance — done vs next

**Done:** no webfonts · AVIF/WebP + responsive sizes · hero preload, rest lazy · tall-image auto-slicing · blur-up placeholders · `content-visibility` below fold · immutable upload cache · ISR 60s · fire-and-forget CAPI/Telegram/Sheets · minimal client JS.

**Recommended next (in order of ROI):**
1. **Re-run Lighthouse on production** — confirm CLS ≈ 0 and Performance back in green after the fixes.
2. **Image budget per product:** keep each landing under ~10 images / ~500 KB total; the admin shows file sizes after upload — act on them.
3. **Pre-warm ISR:** after publishing a product, open its URL once so the cached copy exists before ad traffic hits.
4. **Cloudflare (optional, free):** in front of Vercel for edge caching + image resizing if traffic scales beyond thousands/day.

## 3. Backend & database (the real risks)

1. **🔴 Missing indexes (do first):** only PKs + slug unique exist. As orders grow, dashboard + lookups slow down. Add:
   `orders(status, id)`, `orders(product_slug)`, `orders(created_at)`, `orders(phone)`.
2. **🔴 No rate limiting on `/api/orders`:** anyone can spam fake orders → junk Telegram/Sheets + burned CAPI quota + polluted pixel. Add IP-based throttle (e.g. 5 orders/10 min) + keep silent drafts cheap.
3. **Draft hygiene:** background drafts accumulate for visitors who never order. Weekly: export phones with no order → callback list (this is free money), then delete drafts older than 30 days.
4. **Backups:** Neon keeps automatic backups — verify Point-in-Time Recovery is on + download a shipping JSON (already one click in settings) before any bulk edit.
5. **Connection pooling:** single `pg` Pool (max 10) is fine for COD scale; revisit only past ~50 concurrent checkouts.

## 4. Ads & tracking optimization

1. **Test Event Code is cleared in both DBs** ✅ — new events now count toward optimization. Never test with live traffic again without re-adding it temporarily.
2. **Watch EMQ score** (Events Manager → your dataset → Event Match Quality): target 7+/10. Levers already sending: E.164 phone, city, state, country, fbp/fbc, IP/UA. Do NOT add an email field to the COD form — it would cost more conversions than the score is worth.
3. **Advertiser-side checklist:** domain verified in Business Settings · Aggregated Events configured (8 slots, Purchase first) · catalog created only if/when running dynamic retargeting ads.
4. **Attribution reality:** COD "Purchase" fires at order placement, but cash is collected on delivery. Monthly: compare Meta-reported purchases vs actually delivered orders, and optimize toward confirmed/delivered (update order status honestly — the dashboard exists for this).

## 5. Conversion (COD funnel)

1. **Speed is the funnel:** every 0.5s of LCP costs orders on 4G. Guard the image budget (point 2 above).
2. **Form friction:** keep 4 required fields max (already the case). Phone accepts `05…` and `+213…`.
3. **Trust signals to consider:** reviews/testimonials block, "pay on delivery" badges near the button, delivery-time estimate per wilaya.
4. **Abandoned drafts = callback gold:** phone numbers of visitors who typed info but never ordered — call them within 24h.
5. **Confirmation call script:** the `#ID — total` in Telegram + admin exists precisely to make confirmation calls fast. Measure confirm rate; below ~60% usually means price/shipping surprise — check totals display.

## 6. SEO & discoverability (cheap wins)

1. Add `sitemap.xml` + `robots.txt` (product URLs change rarely — generate at build or on publish).
2. Each landing already has title/description/OG image — verify share previews once per product (Facebook Sharing Debugger).
3. `hreflang`/canonical can wait — traffic is ad-driven, not search-driven.

## 7. Security checklist

- [ ] `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` changed from placeholders (still pending!)
- [ ] Neon password rotated (it was pasted in chat) + old token revoked
- [ ] FB test code cleared in both DBs (done — keep it that way except during tests)
- [ ] Rate limit order endpoints (see §3.2)
- [ ] Telegram bot token / Sheets key live only in DB settings, never in git (`.env` is ignored ✅)
- [ ] Consider Vercel Deployment Protection or IP-allowlist for `/admin/*` later

## 8. Costs to watch

- **Vercel:** Hobby is fine until function timeouts/usage bite (upload route allows 60s — needs Pro past 10s sustained). Blob free tier ≈ 1 GB images.
- **Neon:** free tier covers early COD volume; watch storage + compute hours in dashboard.
- **Meta:** Pixel + CAPI are free, unlimited events. Money goes to ad spend, not tooling.

## 9. Suggested order of work

1. Rotate Neon password + set real `ADMIN_PASSWORD` (today, 10 min)
2. Add DB indexes + order rate limiting (one dev session)
3. Re-run Lighthouse, fix anything new (30 min)
4. Weekly ops habit: callback draft phones, confirm-rate check, shipping fees review
5. When scaling: Cloudflare, sitemap, delivered-vs-reported reconciliation

---
*Built by Ihab — دعوة في ظهر الغيب تكفي 🤲*
