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
    const el = document.getElementById("order");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setPast(entry.isIntersecting),
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
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
