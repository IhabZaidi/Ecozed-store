"use client";

/**
 * Browser-side Facebook Pixel — PageView ONLY (Meta's official snippet,
 * inlined so it runs even before/without Next.js hydration).
 * ViewContent, InitiateCheckout and Purchase are sent server-side via the
 * Conversions API (never blocked by ad-blockers, no double counting).
 * The snippet itself is ~600 bytes and loads fbevents.js async —
 * it never blocks first paint.
 */
export default function Pixel({ pixelId }: { pixelId: string }) {
  if (!pixelId) return null;

  const init = `
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${pixelId}');
    fbq('track', 'PageView');
  `;

  return (
    <>
      {/* early connection setup (~1 RTT saved on fbevents.js) */}
      <link rel="preconnect" href="https://connect.facebook.net" />
      <link rel="dns-prefetch" href="https://connect.facebook.net" />
      <script dangerouslySetInnerHTML={{ __html: init }} />
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
