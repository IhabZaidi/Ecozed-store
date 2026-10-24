"use client";

import { useEffect, useRef, useState } from "react";
import { WILAYAS } from "@/lib/wilayas";
import type { ShippingTable } from "@/lib/settings";

type Offer = { qty: number; price: number; label?: string };

type Props = {
  slug: string;
  title: string;
  price: number;
  ctaText: string;
  pricingMode?: string | null;
  offers?: Offer[] | null;
  ship: ShippingTable;
  pixelId: string;
  /** landing pages: plain numbers without separators (2800 not 2.800) */
  plainNumbers?: boolean;
};

function qtyLabel(n: number) {
  if (n === 1) return "قطعة واحدة";
  if (n === 2) return "قطعتان";
  return `${n} قطع`;
}

function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

// Same normalization as the server (05/06/07… or +213…). Null = unusable.
// Local helper (not imported from lib) to keep the landing client bundle lean.
function normalizeClientPhone(raw: string): string | null {
  let d = raw.replace(/[\s.\-()]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  d = d.replace(/\D/g, "");
  if (d.startsWith("00213") && d.length === 14) d = d.slice(2);
  if (d.startsWith("213") && d.length === 12) d = "0" + d.slice(3);
  return /^(05|06|07)\d{8}$/.test(d) ? d : null;
}

export default function OrderForm({
  slug,
  price,
  ctaText,
  pricingMode,
  offers,
  ship,
  pixelId,
  plainNumbers,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<null | { id: number; total: number }>(null);
  const [error, setError] = useState("");
  const [qty, setQty] = useState(1);
  const [sel, setSel] = useState(0);
  const [wilaya, setWilaya] = useState("");
  const [method, setMethod] = useState<"home" | "stopdesk">("home");

  // Background draft: saved silently while typing (no new step, no events).
  // One row per visitor — created once, then updated debounced.
  const draftRef = useRef<{ id: number; key: string } | null>(null);
  const draftKeyRef = useRef("");
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Purchase-twin fire-once guard: keyed by orderId, so even a retried render
  // or double success-path can never emit a second browser Purchase.
  const purchaseFiredRef = useRef<number | null>(null);
  // InitiateCheckout guard: keyed by eventId to prevent multi-fire on retry/re-render
  const icFiredRef = useRef<string | null>(null);
  const liveRef = useRef({ orderQty: 1, delivery: "home" as "home" | "stopdesk" });

  const validOffers = ((offers ?? []) as Offer[]).filter(
    (o) => o.qty >= 1 && o.price >= 100
  );
  const isOffers = pricingMode === "offers" && validOffers.length > 0;
  const chosen = isOffers
    ? validOffers[Math.min(sel, validOffers.length - 1)]
    : null;
  const orderQty = chosen ? chosen.qty : qty;
  const cost = chosen ? chosen.price : price * qty;
  // Visible methods: a method shows for the chosen wilaya only if its fee
  // there is above 0. No wilaya yet → preview both. Neither qualifies →
  // no delivery: notice + blocked submit.
  const methodList: ("home" | "stopdesk")[] = (() => {
    if (!wilaya) return ship.stopEnabled ? ["home", "stopdesk"] : ["home"];
    const list: ("home" | "stopdesk")[] = [];
    if ((ship.home[wilaya] ?? 0) > 0) list.push("home");
    if (ship.stopEnabled && (ship.stop[wilaya] ?? 0) > 0)
      list.push("stopdesk");
    return list;
  })();
  const hasOption = wilaya === "" || methodList.length > 0;
  const delivery = methodList.includes(method)
    ? method
    : (methodList[0] ?? "home");
  const feeMap = delivery === "stopdesk" ? ship.stop : ship.home;
  const shipCost = feeMap[wilaya] ?? 0;
  const total = cost + shipCost;
  const stopName = ship.company
    ? `مكتب (${ship.company})`
    : "مكتب الاستلام";
  const fmt = (n: number) =>
    plainNumbers ? String(n) : n.toLocaleString("ar-DZ");

  // Keep latest qty/method for the debounced draft saver (avoids stale closures).
  useEffect(() => {
    liveRef.current = { orderQty, delivery };
  });
  useEffect(
    () => () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    },
    []
  );

  function queueDraft(form: HTMLFormElement) {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => void saveDraft(form), 1500);
  }

  async function saveDraft(form: HTMLFormElement) {
    if (!form.isConnected) return;
    const fd = new FormData(form);
    const name = String(fd.get("fullName") || "").trim();
    const phone = normalizeClientPhone(String(fd.get("phone") || ""));
    // Only real info creates rows — no junk drafts from half-typed forms.
    if (!phone || name.length < 3) return;
    if (!draftKeyRef.current) draftKeyRef.current = uid();
    const { orderQty: q, delivery: d } = liveRef.current;
    try {
      const res = await fetch("/api/orders/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          fullName: name,
          phone: String(fd.get("phone") || ""),
          wilayaCode: String(fd.get("wilayaCode") || ""),
          commune: String(fd.get("commune") || ""),
          address: String(fd.get("address") || ""),
          qty: q,
          delivery: d,
          ...(draftRef.current
            ? { draftId: draftRef.current.id, key: draftRef.current.key }
            : { eventId: draftKeyRef.current }),
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.orderId) {
        draftRef.current = {
          id: data.orderId,
          key: data.key || draftKeyRef.current,
        };
      }
    } catch {
      /* silent: drafts must never disturb the buyer */
    }
  }

  // NOTE: no event fires from focus, typing, or failed submits.
  // InitiateCheckout is sent only after the server confirms the order saved
  // (see onSubmit success path), and Purchase is sent by the server itself
  // strictly after the DB insert. Incomplete forms and no-shipping wilayas
  // therefore emit zero events.

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const eventId = uid();
    const body = {
      slug,
      fullName: String(fd.get("fullName") || ""),
      phone: String(fd.get("phone") || ""),
      wilayaCode: String(fd.get("wilayaCode") || ""),
      commune: String(fd.get("commune") || ""),
      address: String(fd.get("address") || ""),
      qty: orderQty,
      delivery,
      notes: "",
      eventId,
      ...(draftRef.current
        ? { draftId: draftRef.current.id, draftKey: draftRef.current.key }
        : {}),
    };

    // basic client check before the round-trip
    if (body.fullName.trim().length < 3) {
      setError("يرجى إدخال الاسم الكامل");
      setLoading(false);
      return;
    }
    if (!normalizeClientPhone(body.phone)) {
      setError("رقم الهاتف غير صحيح (مثال: 0550123456 أو +213550123456)");
      setLoading(false);
      return;
    }
    if (!body.wilayaCode) {
      setError("اختر الولاية");
      setLoading(false);
      return;
    }
    if (body.commune.trim().length < 2) {
      setError("أدخل البلدية");
      setLoading(false);
      return;
    }
    if (!hasOption) {
      setError("لا يوجد توصيل لهذه الولاية حاليا");
      setLoading(false);
      return;
    }

    try {
      const payload = JSON.stringify(body);
      const send = () =>
        fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          // Slow networks / closed tabs: deliver the POST even on unload.
          keepalive: true,
        });
      let res: Response | null = null;
      try {
        res = await send();
      } catch {
        // Request never got a response (network blip, tunnel drop). One
        // retry with the SAME eventId — the server dedupes by it, so a
        // retry can complete a lost save but never double-save.
        try {
          res = await send();
        } catch {
          res = null;
        }
      }
      if (!res) {
        setError("تعذر إرسال الطلب، تحقق من الاتصال وحاول مجددًا");
        setLoading(false);
        return;
      }
      // Non-JSON body means an infra-level failure above our handler
      // (our API always answers JSON now) — retryable, never silent.
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(data?.error || "حدث خطأ، حاول مرة أخرى");
        setLoading(false);
        return;
      }
      setDone({ id: data.orderId, total: data.total });
      // Draft (if any) just became the real order — stop background updates.
      if (draftTimer.current) clearTimeout(draftTimer.current);
      draftRef.current = null;
      // Browser Purchase twin, sharing the SERVER's canonical event id
      // (data.eventId — draft key or submit id, whichever CAPI used).
      // Triple anti-duplication: (1) same ID ⇒ Meta dedups any repeat into
      // one; (2) fired once per orderId via purchaseFiredRef; (3) value +
      // currency + content_ids mirror the server payload exactly, so the pair
      // matches on content too. fbq may be absent (idle pixel / ad-blocker) —
      // then the server event stands alone and still counts exactly once.
      if (purchaseFiredRef.current !== data.orderId) {
        purchaseFiredRef.current = data.orderId;
        try {
          const fbq = (
            window as unknown as { fbq?: (...args: unknown[]) => void }
          ).fbq;
          if (typeof fbq === "function" && typeof data.eventId === "string" && data.eventId)
            fbq(
              "track",
              "Purchase",
              {
                value: data.total,
                currency: "DZD",
                content_ids: [slug],
                content_type: "product",
              },
              { eventID: data.eventId }
            );
        } catch {
          /* server twin already counted — nothing lost */
        }
        // Beacon removed: fbq + server CAPI (via after()) share same eventID and deduplicate correctly.
        // sendBeacon to tr/ endpoint does NOT dedupe with fbq, creating noise (3x Processed per event).
      }
      // Order really saved as DRAFT (server confirmed 200) → NOW record
      // InitiateCheckout on BOTH sides with the SAME id (Meta dedups the pair):
      // browser twin for CAPI coverage + server twin with full identifiers.
      // fbq may not exist yet (pixel loads at idle) or be blocked — the
      // server event always fires, so coverage never drops to zero.
      const wName = WILAYAS.find((w) => w.code === body.wilayaCode)?.ar ?? "";
      const icId = uid();
      // Browser InitiateCheckout twin with fire-once guard (prevents multi-fire on retry/re-render).
      // Server twin via /api/fb-event shares same icId — Meta deduplicates the pair.
      if (icFiredRef.current !== icId) {
        icFiredRef.current = icId;
        try {
          const fbq = (
            window as unknown as { fbq?: (...args: unknown[]) => void }
          ).fbq;
          if (typeof fbq === "function")
            fbq(
              "track",
              "InitiateCheckout",
              { value: data.total, currency: "DZD" },
              { eventID: icId }
            );
        } catch {
          /* pixel blocked or not loaded yet — server twin covers it */
        }
      }
      fetch("/api/fb-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: "InitiateCheckout",
          eventId: icId,
          slug,
          value: data.total,
          numItems: orderQty,
          contentName: title,
          phone: body.phone,
          fullName: body.fullName.trim(),
          city: body.commune.trim(),
          state: wName,
          country: "dz",
        }),
        // Buyer may close the tab the instant success shows — deliver anyway.
        keepalive: true,
      }).catch(() => {});
      // Notify the page: it hides everything behind a centered success view.
      window.dispatchEvent(
        new CustomEvent("order-completed", {
          detail: { id: data.orderId, total: data.total },
        })
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("تعذر إرسال الطلب، تحقق من الاتصال وحاول مجددًا");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-green-500 bg-green-50 p-6 text-center">
        <div className="text-3xl">✅</div>
        <h3 className="mt-2 text-xl font-extrabold text-green-800">
          تم استلام طلبك بنجاح!
        </h3>
        <p className="mt-2 text-gray-700">
          رقم الطلب <b>#{done.id}</b> — المجموع شامل التوصيل{" "}
          <b>{fmt(done.total)} دج</b>
        </p>
        <p className="mt-1 text-sm text-gray-600">
          سنتصل بك قريبًا للتأكيد. الدفع عند الاستلام.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      onChange={(e) => queueDraft(e.currentTarget)}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-extrabold">📝 املأ معلومات التوصيل</h2>
      <p className="mb-4 text-sm text-gray-500">الدفع نقدًا عند استلام طلبك</p>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-bold">الاسم الكامل *</span>
        <input
          name="fullName"
          required
          minLength={3}
          maxLength={80}
          autoComplete="name"
          placeholder="مثال: أمين بن أحمد"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-black"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-bold">رقم الهاتف *</span>
        <input
          name="phone"
          required
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          placeholder="0550123456 أو +213550123456"
          pattern="(\+213|0)(5|6|7)[0-9]{8}"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-black"
        />
      </label>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">الولاية *</span>
          <select
            name="wilayaCode"
            required
            defaultValue=""
            onChange={(e) => setWilaya(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base outline-none focus:border-black"
          >
            <option value="" disabled>
              اختر…
            </option>
            {WILAYAS.map((w) => (
              <option key={w.code} value={w.code}>
                {w.code} — {w.ar}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">البلدية *</span>
          <input
            name="commune"
            required
            minLength={2}
            maxLength={80}
            placeholder="مثال: باب الزوار"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-black"
          />
        </label>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-bold">
          العنوان (اختياري)
        </span>
        <input
          name="address"
          maxLength={200}
          autoComplete="street-address"
          placeholder="الشارع / الحي / نقطة معروفة"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base outline-none focus:border-black"
        />
      </label>

      {isOffers ? (
        <div className="mb-4 space-y-5">
          <p className="text-sm font-bold">🎁 اختر العرض:</p>
          {validOffers.map((o, i) => {
            const save = price * o.qty - o.price;
            const active = chosen === o;
            return (
              <button
                key={o.qty}
                type="button"
                onClick={() => setSel(i)}
                aria-pressed={active}
                className={`relative flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-right transition ${
                  active
                    ? "border-green-600 bg-green-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                {save > 0 && (
                  <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-red-200 bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 shadow-sm">
                    وفّر {fmt(save)} دج
                  </span>
                )}
                <span className="font-extrabold">
                  {active ? "✅ " : ""}
                  {qtyLabel(o.qty)}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="font-black">
                    {fmt(o.price)} دج
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
          <span className="text-sm font-bold">الكمية</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="إنقاص"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="h-9 w-9 rounded-full border border-gray-300 bg-white text-xl font-bold"
            >
              −
            </button>
            <span className="min-w-6 text-center text-lg font-extrabold">
              {qty}
            </span>
            <button
              type="button"
              aria-label="زيادة"
              onClick={() => setQty((q) => Math.min(10, q + 1))}
              className="h-9 w-9 rounded-full border border-gray-300 bg-white text-xl font-bold"
            >
              +
            </button>
          </div>
          <span className="text-sm font-bold">
            {fmt(cost)} دج
          </span>
        </div>
      )}

      {methodList.length > 1 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-bold">🚚 طريقة الاستلام:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethod("home")}
              aria-pressed={delivery === "home"}
              className={`rounded-xl border-2 px-3 py-2.5 text-sm font-extrabold transition ${
                delivery === "home"
                  ? "border-green-600 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              🏠 للمنزل
              <span className="block text-xs font-bold text-gray-500">
                {wilaya
                  ? `${fmt(ship.home[wilaya] ?? 0)} دج`
                  : "—"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMethod("stopdesk")}
              aria-pressed={delivery === "stopdesk"}
              className={`rounded-xl border-2 px-3 py-2.5 text-sm font-extrabold transition ${
                delivery === "stopdesk"
                  ? "border-green-600 bg-green-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              🏢 {stopName}
              <span className="block text-xs font-bold text-gray-500">
                {wilaya
                  ? `${fmt(ship.stop[wilaya] ?? 0)} دج`
                  : "—"}
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 space-y-1 rounded-xl bg-gray-50 px-4 py-3 text-sm font-bold">
        <div className="flex justify-between">
          <span>💰 سعر {isOffers ? "العرض" : "المنتج"}</span>
          <span>{fmt(cost)} دج</span>
        </div>
        <div className="flex justify-between">
          <span>
            🚚 التوصيل {delivery === "stopdesk" ? `(${stopName})` : "للمنزل"}
            {wilaya ? "" : " (حسب الولاية)"}
          </span>
          <span>{fmt(shipCost)} دج</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-black text-green-700">
          <span>المجموع</span>
          <span>{fmt(total)} دج</span>
        </div>
      </div>

      {wilaya !== "" && !hasOption && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-800">
          ⚠️ لا يوجد توصيل لهذه الولاية حاليا
        </p>
      )}

      {error && (
        <p className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || (wilaya !== "" && !hasOption)}
        className="w-full rounded-2xl bg-green-700 px-6 py-4 text-lg font-extrabold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? "جارٍ إرسال الطلب…" : `✅ ${ctaText}`}
      </button>
      <p className="mt-2 text-center text-xs text-gray-500">
        بالضغط على زر الطلب أنت توافق على أن نتصل بك للتأكيد.
      </p>
    </form>
  );
}
