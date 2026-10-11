"use client";

import Script from "next/script";

/**
 * Browser-side Facebook Pixel — PageView + ViewContent via fbq, each paired
 * with a server-side CAPI twin sharing the same event ID (Meta dedups the
 * pair). InitiateCheckout and Purchase twins are fired from OrderForm after
 * the server confirms the save. Server-side sending is never blocked by
 * ad-blockers and carries the full identifier set (no double counting).
 *
 * CAPI coverage: the browser PageView carries a per-visit eventID AND the
 * same ID is posted to /api/fb-event, which fires the server twin. Meta
 * dedups on (event_name + event_id), so the pair counts once and PageView
 * CAPI coverage goes to ~100% (fixes the "57 fewer server events" flag).
 * Ad-blocked visitors contribute the server event alone — still exactly one.
 *
 * First-visit matching: most buyers visit ONCE, so the server twins wait for
 * the `_fbp` cookie (written by fbevents.js) before firing — up to ~4s of
 * 200ms polls. Without this, one-time visitors' twins would arrive fbp-less
 * and match worse. If the cookie never appears (blocked/slow), the twins
 * fire anyway with IP + UA, exactly as before — never lost, just leaner.
 *
 * Perf: loads with strategy="lazyOnload" (browser idle, after LCP) instead
 * of competing with the hero image. Lighthouse flagged fbevents.js as
 * ~41KB unused-JS + 143ms bootup on the critical path — idle-loading moves
 * it (and the 96KB signals/config it pulls) fully out of the LCP window.
 */
export default function Pixel({ pixelId, slug, price }: { pixelId: string; slug: string; price?: number }) {
  if (!pixelId) return null;

  // ViewContent redundant pair: browser twin fires immediately with the fbq
  // PageView, server twin fires from fire() below with the SAME id (Meta
  // dedups the pair; either side alone still counts exactly once). The
  // server twin waits for _fbp so first-visit matching stays strong; the
  // browser twin needs no wait (fbq reads its own cookies).
  const vcValue = typeof price === "number" && price > 0 ? Math.round(price) : 0;
  const viewContentFbq = vcValue
    ? `fbq('track', 'ViewContent', { content_ids: [${JSON.stringify(slug)}], content_type: 'product', value: ${vcValue}, currency: 'DZD' }, { eventID: vcid });`
    : "";
  const viewContentPost = vcValue
    ? `post(JSON.stringify({ eventName: 'ViewContent', eventId: vcid, slug: ${JSON.stringify(slug)}, value: ${vcValue} }));`
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
      var vcid = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      fbq('track', 'PageView', {}, { eventID: eid });
      ${viewContentFbq}
      function post(body) {
        try {
          fetch('/api/fb-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
            keepalive: true
          }).catch(function(){});
        } catch (e) {}
      }
      var sent = false;
      function fire() {
        if (sent) return;
        sent = true;
        post(JSON.stringify({ eventName: 'PageView', eventId: eid, slug: ${JSON.stringify(slug)} }));
        ${viewContentPost}
      }
      // Instant bouncers (<1s on page): pending timers die with the page, so
      // flush unsent twins here with whatever identifiers exist (keepalive
      // delivers on unload). Engaged visits get the fbp-enriched send above.
      try {
        window.addEventListener('pagehide', function() { fire(); });
      } catch (e) {}
      var tries = 0;
      (function wait() {
        var hasFbp = false;
        try { hasFbp = /(?:^|;\\s*)_fbp=/.test(document.cookie); } catch (e) {}
        if (hasFbp || ++tries > 20) { fire(); return; }
        setTimeout(wait, 200);
      })();
    })();`,
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
