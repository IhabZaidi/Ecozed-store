# Ecozed Store — COD Landing Pages (DZ 🇩🇿)

Next.js + Tailwind + local Postgres + Google Sheets + Telegram. No storefront — every
product is a super-fast Arabic RTL landing page at `/{slug}` with a Cash-on-Delivery form.

## 1) Setup (local Postgres)

```bash
npm install
cp .env.example .env   # then fill it
docker compose up -d db             # one-command local Postgres 16
# ...or use your own Postgres and set DATABASE_URL to it
npm run db:push        # creates products + orders tables
npm run dev
```

Default local URL: `postgresql://postgres:postgres@localhost:5432/ecozed`

Required env: `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`,
`NEXT_PUBLIC_SITE_URL`. Pixel, Telegram and Google Sheets are configured in
`/admin` settings (DB) — their env vars remain only as fallback.

## 2) Admin flow

1. Open `/admin` → login with `ADMIN_PASSWORD`.
2. “منتج جديد” → fill title/price, upload images (auto-compressed to WebP 1200px q72),
   save → landing page is live at `/your-slug`.
3. Share that link in Facebook ads. Orders appear in the dashboard + Telegram + Google Sheet.

## Telegram bot setup (order notifications)

1. In Telegram, open **@BotFather** → `/newbot` → name it → copy the token.
2. Open your new bot and press **Start** (send any message).
3. Open **@userinfobot** → it replies with your numeric ID (Chat ID).
4. In `/admin` → **⚙️ الإعدادات** → Telegram section → paste token + Chat ID → save.
5. Click **✉️ إرسال رسالة تجربة** — the test message must arrive in Telegram.
   Every new order then notifies you instantly. A broken token never blocks orders.

## 3) Facebook Pixel + CAPI (deduplicated)

Configure in `/admin` → **⚙️ البكسل** (Pixel ID + CAPI token + optional test code).
Stored in the `settings` table, applied within a minute — env vars are only the fallback.

Event map (each conversion counted exactly once):
- Browser: `PageView` only (Meta's official snippet, inlined — no ad-block-safe dependency)
- Server (CAPI): `ViewContent` on page view, `InitiateCheckout` after a valid
  order is confirmed saved, `Lead` on draft save, `Purchase` strictly on client
  confirmation (hashed phone, `fbp`/`fbc` for matching). Incomplete forms, failed
  validation and no-shipping wilayas emit zero events.
- Test with a Test Event Code in settings, then clear it. Verify in Events Manager → Test Events.

## 4) Speed strategy (why landing is fast)

- No Google Fonts (system Arabic stack), no heavy libs on landing (only Pixel + form JS).
- `next/image` AVIF→WebP, hero `priority + fetchPriority=high`, rest lazy, `sizes` capped at 640px.
- **Tall-image splitting:** images over 1800px tall are auto-sliced at upload into
  ≤900px parts that paint top-down (WebP/AVIF can't render progressively, so one
  giant file would block first paint). Parts share a group id and stack seamlessly.
- **Blur-up placeholders:** every upload records a ~300B LQIP — instant paint, sharp swap.
- **`content-visibility: auto`** on below-fold blocks (browser skips their layout/paint).
- **Immutable 1-year cache** on `/uploads/*` (filenames are unique per upload).
- **Pixel preconnect** only when a pixel is configured.
- ISR (`revalidate = 60`): cached HTML, fresh prices.
- Pixel loads inline + `noscript` fallback; CAPI fire-and-forget (never blocks TTFB).
- Uploaded images stripped + resized + WebP via Sharp. Keep admin originals under 5MB.

## 5) Order pipeline

`POST /api/orders` → Zod validate (DZ phone `05/06/07xxxxxxxx` or `+213…`, wilaya, commune)
→ price resolved server-side (offer must match exactly, or qty × unit price)
→ shipping resolved server-side from settings (per-wilaya fee or default)
→ Postgres `orders` row → CAPI `Purchase` → Telegram message → Google Sheet row.
Sheet: share the spreadsheet with `GOOGLE_SHEETS_CLIENT_EMAIL` first.

Shipping modes (settings → 🚚): **🏠 home** and **🏢 stopdesk** (with
shipping company name shown to the client). Per-wilaya home/stopdesk fees —
empty means free delivery; stopdesk shows only when a fee above 0 exists.
Server rejects stopdesk orders when disabled. Total = price + fee.

Pricing modes (per product, set in admin): **📦 quantity** (stepper × unit price)
or **🎁 offers** (client picks a pack, savings badge vs unit price).
Client always sees cost + shipping = total (landing pages stay price-free by design).
