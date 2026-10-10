"use client";

import { useEffect, useState } from "react";

/**
 * Sticky bottom CTA that hides itself while the order form is visible
 * (no point showing "order now" when you're already ordering).
 * IntersectionObserver = no scroll listeners, compositor-friendly slide.
 */
export default function StickyCta({
  children,
}: {
  children: React.ReactNode;
}) {
  const [past, setPast] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    let obs: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    const watch = (el: Element) => {
      obs = new IntersectionObserver(
        ([entry]) => setPast(entry.isIntersecting),
        { threshold: 0.12 }
      );
      obs.observe(el);
    };
    // OrderForm is code-split and mounts after LCP — it may not exist yet.
    const existing = document.getElementById("order");
    if (existing) {
      watch(existing);
    } else if (typeof MutationObserver !== "undefined") {
      mo = new MutationObserver(() => {
        const el = document.getElementById("order");
        if (el) {
          watch(el);
          mo?.disconnect();
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      obs?.disconnect();
      mo?.disconnect();
    };
  }, []);

  return (
    <a
      href="#order"
      aria-hidden={past}
      tabIndex={past ? -1 : 0}
      className={`fixed bottom-0 left-0 right-0 z-20 border-t border-gray-200 bg-white/95 p-3 backdrop-blur transition-all duration-300 ${
        past
          ? "pointer-events-none translate-y-full opacity-0"
          : "translate-y-0 opacity-100"
      }`}
    >
      {children}
    </a>
  );
}
