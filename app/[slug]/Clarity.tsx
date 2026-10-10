"use client";

import Script from "next/script";

/**
 * Microsoft Clarity — heatmaps + session recordings (user-behavior tracking).
 *
 * Perf: strategy="lazyOnload" (browser idle, after LCP/TTI), same pattern as
 * the Facebook Pixel. No preconnect, no render-blocking, ~0 bytes on the
 * critical path. When no ID is configured it renders nothing at all.
 */
export default function Clarity({ clarityId }: { clarityId: string }) {
  if (!clarityId) return null;

  return (
    <Script
      id="ms-clarity"
      strategy="lazyOnload"
      dangerouslySetInnerHTML={{
        __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};(t=l.createElement(r));t.async=1;t.src="https://www.clarity.ms/tag/"+i;(y=l.getElementsByTagName(r)[0]);y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(clarityId)});`,
      }}
    />
  );
}
