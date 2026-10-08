"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen centered success view. The order form fires an
 * `order-completed` event on success → images/landing hide behind this
 * opaque overlay and only the confirmation text shows, centered.
 */
export default function DoneOverlay({ plain }: { plain?: boolean }) {
  const [done, setDone] = useState<{ id: number; total: number } | null>(null);

  useEffect(() => {
    const fn = (e: Event) =>
      setDone((e as CustomEvent<{ id: number; total: number }>).detail);
    window.addEventListener("order-completed", fn);
    return () => window.removeEventListener("order-completed", fn);
  }, []);

  useEffect(() => {
    if (!done) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [done]);

  if (!done) return null;
  const total =
    plain === true ? String(done.total) : done.total.toLocaleString("ar-DZ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white p-6">
      <div className="text-center">
        <div className="text-5xl">✅</div>
        <h2 className="mt-3 text-2xl font-black text-green-800">
          تم استلام طلبك بنجاح!
        </h2>
        <p className="mt-3 text-lg text-gray-700">
          رقم الطلب <b>#{done.id}</b> — المجموع شامل التوصيل{" "}
          <b>{total} دج</b>
        </p>
        <p className="mt-2 text-sm text-gray-600">
          سنتصل بك قريبًا للتأكيد. الدفع عند الاستلام.
        </p>
      </div>
    </div>
  );
}
