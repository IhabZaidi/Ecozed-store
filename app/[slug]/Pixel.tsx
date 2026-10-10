"use client";

import Script from "next/script";

/**
 * Browser-side Facebook Pixel — PageView ONLY (Meta's official snippet).
 * ViewContent, InitiateCheckout and Purchase are sent server-side via the
 * Conversions API (never blocked by ad-blockers, no double counting).
 *
 * Perf: loads with strategy="lazyOnload" (browser idle, after LCP) instead
 * of competing with the hero image. Lighthouse flagged fbevents.js as
 * ~41KB unused-JS + 143ms bootup on the critical path — idle-loading moves
 * it (and the 96KB signals/config it pulls) fully out of the LCP window.
 * Server CAPI ViewContent already fires at request time, so no signal lost.
 */
export default function Pixel({ pixelId }: { pixelId: string }) {
  if (!pixelId) return null;

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
    fbq('track', 'PageView');`,
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
