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
    <div className="space-y-3">
      <fieldset className="rounded-xl border p-3">
        <legend className="px-1 text-sm font-bold">طريقة البيع *</legend>
        <label className="flex items-center gap-2 py-1 font-bold">
          <input
            type="radio"
            name="pricingMode"
            value="qty"
            checked={mode === "qty"}
            onChange={() => setMode("qty")}
            className="h-5 w-5"
          />
          📦 بالكمية — الزبون يختار العدد × سعر الوحدة
        </label>
        <label className="flex items-center gap-2 py-1 font-bold">
          <input
            type="radio"
            name="pricingMode"
            value="offers"
            checked={mode === "offers"}
            onChange={() => setMode("offers")}
            className="h-5 w-5"
          />
          🎁 عروض — الزبون يختار من باقات بأسعار ثابتة
        </label>
      </fieldset>

      {mode === "offers" && (
        <div className="rounded-xl border p-3">
          <input type="hidden" name="offersJson" value={offersJson} />
          <p className="mb-2 text-sm font-bold">
            الباقات (حتى 5) {basePriceHint || ""}
          </p>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    value={r.qty}
                    onChange={(e) => setRow(i, { qty: e.target.value })}
                    inputMode="numeric"
                    placeholder="الكمية"
                    aria-label="الكمية"
                    className="w-24 rounded-lg border px-3 py-2"
                  />
                  <span className="text-sm">قطع بـ</span>
                  <input
                    value={r.price}
                    onChange={(e) => setRow(i, { price: e.target.value })}
                    inputMode="numeric"
                    placeholder="السعر (دج)"
                    aria-label="السعر"
                    className="flex-1 rounded-lg border px-3 py-2"
                  />
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((_, x) => x !== i))}
                      aria-label="حذف العرض"
                      className="rounded-lg border border-red-300 px-3 py-2 font-bold text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <input
                  value={r.label}
                  onChange={(e) => setRow(i, { label: e.target.value })}
                  maxLength={40}
                  placeholder="نص اختياري يظهر على العرض: عرض محدود، خصم 60%…"
                  aria-label="نص العرض"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
          {rows.length < 5 && (
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, { qty: "", price: "", label: "" }])}
              className="mt-2 rounded-xl border px-4 py-2 text-sm font-bold"
            >
              + إضافة عرض
            </button>
          )}
        </div>
      )}
    </div>
  );
}
