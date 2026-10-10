"use client";

import Script from "next/script";

/**
 * Browser-side Facebook Pixel — PageView ONLY (Meta's official snippet).
 * ViewContent, InitiateCheckout and Purchase are sent server-side via the
 * Conversions API (never blocked by ad-blockers, no double counting).
 *
 * CAPI coverage: the browser PageView carries a per-visit eventID AND the
 * same ID is posted to /api/fb-event, which fires the server twin. Meta
 * dedups on (event_name + event_id), so the pair counts once and PageView
 * CAPI coverage goes to ~100% (fixes the "57 fewer server events" flag).
 * Ad-blocked visitors contribute the server event alone — still exactly one.
 *
 * Perf: loads with strategy="lazyOnload" (browser idle, after LCP) instead
 * of competing with the hero image. Lighthouse flagged fbevents.js as
 * ~41KB unused-JS + 143ms bootup on the critical path — idle-loading moves
 * it (and the 96KB signals/config it pulls) fully out of the LCP window.
 * The CAPI twins (PageView + ViewContent) fire from here at idle with full
 * identifiers, so no signal is lost by deferring.
 */
export default function Pixel({ pixelId, slug, price }: { pixelId: string; slug: string; price?: number }) {
  if (!pixelId) return null;

  // ViewContent twin: the Server Component can't send it (no fbp/fbc/IP
  // without killing ISR caching, and identifier-less CAPI events are
  // skipped). Fired here at idle instead — first-party fetch carries the
  // cookies + IP + UA, so it always has identifiers. No browser twin exists
  // for ViewContent, so no dedup key is needed — each view is exactly one.
  const viewContentFetch =
    typeof price === "number" && price > 0
      ? `
      try {
        fetch('/api/fb-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventName: 'ViewContent', eventId: (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)), slug: ${JSON.stringify(slug)}, value: ${Math.round(price)} }),
          keepalive: true
        }).catch(function(){});
      } catch (e) {}`
      : "";

  return (
    <>
      {/* early connection setup (~1 RTT saved when idle-load fires) */}
      <link rel="preconnect" href="https://connect.facebook.net" />
      <Script
        id="fb-pixel-loader"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    (function(){
      var eid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      fbq('track', 'PageView', {}, { eventID: eid });
      try {
        fetch('/api/fb-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventName: 'PageView', eventId: eid, slug: ${JSON.stringify(slug)} }),
          keepalive: true
        }).catch(function(){});
      } catch (e) {}
    })();${viewContentFetch}`,
        }}
      />
      {/* noscript fallback for PageView */}
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
