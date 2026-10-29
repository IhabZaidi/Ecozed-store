import { NextResponse } from "next/server";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, products } from "@/lib/schema";
import { orderSchema } from "@/lib/validation";
import { wilayaName } from "@/lib/wilayas";
import { getShipping, shippingFor, deliveryLabel } from "@/lib/settings";
import { sendCapi, getFbpFbc, clientIp, splitName, cleanFbp, cleanFbc } from "@/lib/fb";
import { sendTelegram, orderTelegramText } from "@/lib/telegram";
import { appendOrderToSheet } from "@/lib/sheets";

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = orderSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    // Field paths only, never values (no PII in logs). Tells us whether
    // legit buyers are being bounced by validation (e.g. stale offers).
    console.warn(
      "order rejected",
      parsed.error.issues.map((i) => `${i.path.join(".")}:${i.code}`).join(",")
    );
    return NextResponse.json(
      { error: first?.message || "تحقق من الحقول وحاول مجددًا" },
      { status: 400 }
    );
  }
  const v = parsed.data;

  // Idempotent retry: a buyer who taps submit twice, loses signal mid-POST,
  // or auto-retries must NEVER create two rows. Every submit carries a
  // client-generated eventId (and usually a draftId); if either already
  // resolved into a real order, return THAT order instead of inserting.
  // The returned eventId is the one the server Purchase used, so the
  // browser twin still dedups correctly on the retry path too.
  const priorResponse = async () => {
    if (v.draftId) {
      const d = await db
        .select()
        .from(orders)
        .where(eq(orders.id, v.draftId))
        .limit(1);
      const row = d[0];
      if (row && row.status !== "draft") return row;
    }
    if (v.eventId) {
      const p = await db
        .select()
        .from(orders)
        .where(eq(orders.fbEventId, v.eventId))
        .limit(1);
      if (p[0] && p[0].status !== "draft") return p[0];
    }
    return null;
  };
  try {
    const prior = await priorResponse();
    if (prior) {
      return NextResponse.json({
        ok: true,
        orderId: prior.id,
        total: prior.total,
        shipping: prior.shipping,
        subtotal: prior.total - (prior.shipping ?? 0),
        delivery: prior.delivery,
        eventId: prior.fbEventId,
        deduped: true,
      });
    }
  } catch {
    // Lookup failed (DB blip) — fall through to the normal path, which has
    // its own error handling. Never fail a save because the dedup check died.
  }

  try {

  // product must exist + active
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.slug, v.slug))
    .limit(1);
  const product = rows[0];
  if (!product || !product.active) {
    return NextResponse.json({ error: "المنتج غير متوفر" }, { status: 404 });
  }

  const qty = v.qty;
  // Price is resolved SERVER-side: offers mode requires an exact offer match,
  // otherwise the client could tamper the quantity for a cheaper price.
  let subtotal: number;
  let unitPrice = product.price;
  if ((product.pricingMode ?? "qty") === "offers") {
    const list = (product.offers ?? []) as { qty: number; price: number; perPiece?: boolean }[];
    const offer = list.find((o) => o.qty === qty);
    if (!offer) {
      return NextResponse.json({ error: "العرض غير متوفر" }, { status: 400 });
    }
    subtotal = offer.perPiece ? offer.price * offer.qty : offer.price;
    unitPrice = offer.perPiece ? offer.price : Math.round(offer.price / offer.qty);
  } else {
    subtotal = product.price * qty;
  }
  // Shipping is resolved SERVER-side from the settings table.
  // A method is available for a wilaya only if its fee there is above 0.
  // Neither available → no delivery for this wilaya (client shows it too).
  const shipTable = await getShipping();
  const delivery = v.delivery === "stopdesk" ? "stopdesk" : "home";
  const homeFee = shipTable.home[v.wilayaCode];
  const stopFee = shipTable.stop[v.wilayaCode];
  const homeOk = (homeFee ?? 0) > 0;
  const stopOk = shipTable.stopEnabled && (stopFee ?? 0) > 0;
  if (!homeOk && !stopOk) {
    return NextResponse.json(
      { error: "لا يوجد توصيل لهذه الولاية حاليا" },
      { status: 400 }
    );
  }
  if (delivery === "stopdesk" && !stopOk) {
    return NextResponse.json(
      { error: "التوصيل للمكتب غير متوفر لهذه الولاية" },
      { status: 400 }
    );
  }
  if (delivery === "home" && !homeOk) {
    return NextResponse.json(
      { error: "التوصيل للمنزل غير متوفر لهذه الولاية" },
      { status: 400 }
    );
  }
  const shipping = shippingFor(shipTable, v.wilayaCode, delivery);
  const total = subtotal + shipping;
  const wName = wilayaName(v.wilayaCode);
  const { fbp, fbc } = getFbpFbc(req);
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "";
  const eventId = v.eventId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL) || "";

  // 1) Save to local Postgres. If this browser already auto-saved a draft
  // (same id + private key), upgrade THAT row instead of inserting a second
  // one — one visitor = one order row, always.
  const row = {
    productId: product.id,
    productSlug: product.slug,
    productTitle: product.title,
    qty,
    unitPrice,
    shipping,
    delivery,
    total,
    fullName: v.fullName.trim(),
    phone: v.phone,
    wilayaCode: v.wilayaCode,
    wilayaName: wName,
    commune: v.commune.trim(),
    address: v.address.trim(),
    notes: v.notes,
    status: "new",
    fbp: cleanFbp(v.fbp || fbp),
    fbc: cleanFbc(v.fbc || fbc),
    clientIp: ip,
    userAgent: ua,
  };
  let orderId: number;
  let purchaseEventId = eventId;
  const maybeDraft =
    v.draftId && v.draftKey
      ? await db
          .select()
          .from(orders)
          .where(eq(orders.id, v.draftId))
          .limit(1)
      : [];
  const draft = maybeDraft[0];
  if (draft && draft.status === "draft" && draft.fbEventId === v.draftKey) {
    await db.update(orders).set(row).where(eq(orders.id, draft.id));
    orderId = draft.id;
    purchaseEventId = draft.fbEventId || eventId;
  } else {
    const inserted = await db
      .insert(orders)
      .values({ ...row, fbEventId: eventId })
      .returning({ id: orders.id });
    orderId = inserted[0]?.id ?? 0;
  }

  // 2) Server Purchase event (CAPI) — strictly after the DB insert.
  // The browser fires its twin with the SAME purchaseEventId (returned below),
  // so Meta dedups the pair into one. fn/ln + external_id maximize matching.
  const [firstName, lastName] = splitName(v.fullName);
  const baseEvent = {
    eventSourceUrl: siteUrl ? `${siteUrl.replace(/\/+$/, "")}/${product.slug}` : "",
    fbp: cleanFbp(v.fbp || fbp) || undefined,
    fbc: cleanFbc(v.fbc || fbc) || undefined,
    ip: ip || undefined,
    userAgent: ua || undefined,
    phone: v.phone,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    city: v.commune.trim(),
    state: wName,
    country: "dz",
    value: total,
    currency: "DZD",
    contentIds: [product.slug],
    contentName: product.title,
    numItems: qty,
  };
  // Same lifetime guarantee as Telegram/Sheets below: an unawaited CAPI
  // send can die with the frozen function and surface in Meta as a
  // missing server event (phantom coverage gap). after() keeps it alive.
  after(() =>
    sendCapi({ ...baseEvent, eventName: "Purchase", eventId: purchaseEventId }).catch(() => {})
  );

  // 3) Telegram + Google Sheet in background (never block the response)
  const notif = {
    id: orderId,
    productTitle: product.title,
    qty,
    unitPrice,
    total,
    shipping,
    deliveryLabel: deliveryLabel(shipTable, delivery),
    fullName: v.fullName.trim(),
    phone: v.phone,
    wilayaCode: v.wilayaCode,
    wilayaName: wName,
    commune: v.commune.trim(),
    address: v.address.trim(),
  };
  // Telegram + Sheets run in after(): fire-and-forget (void ...) lets Vercel
  // freeze the function the moment the response returns, killing the send
  // mid-flight — the classic "order saved but no Telegram message" flake.
  // after() extends the function lifetime until the work finishes, with zero
  // added latency on the buyer's success screen.
  after(() => sendTelegram(orderTelegramText(notif)).catch(() => {}));
  after(() =>
    appendOrderToSheet([
      new Date().toISOString(),
      orderId,
      product.title,
      qty,
      unitPrice,
      total,
      v.fullName.trim(),
      v.phone,
      v.wilayaCode,
      wName,
      v.commune.trim(),
      v.address.trim(),
      shipping,
      delivery,
    ]).catch(() => {})
  );

  return NextResponse.json({
    ok: true,
    orderId,
    total,
    shipping,
    subtotal,
    delivery,
    // Canonical event ID the server Purchase used (draft key when a draft was
    // upgraded, submit eventId otherwise). The browser fires its Purchase twin
    // with THIS id — identical IDs are how Meta dedups the pair into one.
    eventId: purchaseEventId,
  });
  } catch (e) {
    // Any unexpected throw (DB outage, pool exhaustion…) used to bubble into
    // a Next 500 HTML page: the buyer saw a spinner-turned-nothing and the
    // order was lost with zero fingerprints. Now: structured log + clean JSON
    // so the client shows a retryable error and Vercel logs show the cause.
    // (Slug only — never log buyer PII.)
    console.error("order save failed", v.slug, e);
    return NextResponse.json(
      { error: "تعذر حفظ الطلب، تحقق من الاتصال وحاول مرة أخرى" },
      { status: 500 }
    );
  }
}

