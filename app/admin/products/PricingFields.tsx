"use client";

import { useState } from "react";
import type { ProductOffer } from "@/lib/schema";

type Row = { qty: string; price: string; label: string };

function toRows(offers: ProductOffer[] | null | undefined): Row[] {
  if (!offers || offers.length === 0) return [{ qty: "1", price: "", label: "" }];
  return offers
    .slice(0, 5)
    .map((o) => ({ qty: String(o.qty), price: String(o.price), label: o.label ?? "" }));
}

export function PricingFields({
  initialMode,
  initialOffers,
  basePriceHint,
}: {
  initialMode?: string | null;
  initialOffers?: ProductOffer[] | null;
  basePriceHint?: string;
}) {
  const [mode, setMode] = useState(initialMode === "offers" ? "offers" : "qty");
  const [rows, setRows] = useState<Row[]>(() => toRows(initialOffers));

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, x) => (x === i ? { ...r, ...patch } : r)));
  }

  const offersJson = JSON.stringify(
    rows
      .map((r) => ({
        qty: Math.round(Number(r.qty)),
        price: Math.round(Number(r.price)),
        ...(r.label.trim() ? { label: r.label.trim().slice(0, 40) } : {}),
      }))
      .filter((o) => o.qty >= 1 && o.qty <= 50 && o.price >= 100)
  );

  return (
    <div className="space-y-4">
      <fieldset className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
        <legend className="text-sm font-bold text-gray-900">طريقة البيع *</legend>

        <label className="flex items-center gap-2 py-2">
          <input
            type="radio"
            name="pricingMode"
            value="qty"
            checked={mode === "qty"}
            onChange={() => setMode("qty")}
            className="h-5 w-5 accent-black"
          />
          <span className="font-medium">📦 بالكمية</span>
          <span className="text-sm text-gray-500">— الزبون يختار العدد × سعر الوحدة</span>
        </label>

        <label className="flex items-center gap-2 py-2">
          <input
            type="radio"
            name="pricingMode"
            value="offers"
            checked={mode === "offers"}
            onChange={() => setMode("offers")}
            className="h-5 w-5 accent-black"
          />
          <span className="font-medium">🎁 عروض</span>
          <span className="text-sm text-gray-500">— الزبون يختار من باقات بأسعار ثابتة</span>
        </label>
      </fieldset>

      {mode === "offers" && (
        <fieldset className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <legend className="text-sm font-bold text-gray-900">الباقات (حتى 5)</legend>

          <input type="hidden" name="offersJson" value={offersJson} />

          {basePriceHint && (
            <p className="text-xs text-gray-500">{basePriceHint}</p>
          )}

          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className="flex-1 block space-y-1">
                    <span className="text-xs text-gray-500">الكمية</span>
                    <input
                      value={r.qty}
                      onChange={(e) => setRow(i, { qty: e.target.value })}
                      inputMode="numeric"
                      placeholder="الكمية"
                      aria-label="الكمية"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono focus:border-black focus:outline-none"
                    />
                  </label>

                  <label className="flex-1 block space-y-1">
                    <span className="text-xs text-gray-500">السعر (دج)</span>
                    <input
                      value={r.price}
                      onChange={(e) => setRow(i, { price: e.target.value })}
                      inputMode="numeric"
                      placeholder="السعر (دج)"
                      aria-label="السعر"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono focus:border-black focus:outline-none"
                    />
                  </label>

                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((_, x) => x !== i))}
                      aria-label="حذف العرض"
                      className="self-end rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition"
                    >
                      حذف
                    </button>
                  )}
                </div>

                <label className="block space-y-1">
                  <span className="text-xs text-gray-500">نص العرض (اختياري)</span>
                  <input
                    value={r.label}
                    onChange={(e) => setRow(i, { label: e.target.value })}
                    maxLength={40}
                    placeholder="نص يظهر على العرض: عرض محدود، خصم 60%…"
                    aria-label="نص العرض"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-black focus:outline-none"
                  />
                </label>
              </div>
            ))}
          </div>

          {rows.length < 5 && (
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, { qty: "", price: "", label: "" }])}
              className="mt-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 transition"
            >
              + إضافة عرض
            </button>
          )}
        </fieldset>
      )}
    </div>
  );
}
