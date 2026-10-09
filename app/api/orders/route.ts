import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, products } from "@/lib/schema";
import { orderSchema } from "@/lib/validation";
import { wilayaName } from "@/lib/wilayas";
import { getShipping, shippingFor, deliveryLabel } from "@/lib/settings";
import { sendCapi, getFbpFbc, clientIp } from "@/lib/fb";
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
    return NextResponse.json(
      { error: first?.message || "تحقق من الحقول وحاول مجددًا" },
      { status: 400 }
    );
  }
  const v = parsed.data;

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
    const list = (product.offers ?? []) as { qty: number; price: number }[];
    const offer = list.find((o) => o.qty === qty);
    if (!offer) {
      return NextResponse.json({ error: "العرض غير متوفر" }, { status: 400 });
    }
    subtotal = offer.price;
    unitPrice = Math.round(offer.price / offer.qty);
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
    fbp: v.fbp || fbp,
    fbc: v.fbc || fbc,
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
  // Browser fires nothing but PageView, so each conversion is counted once.
  // Extra match signals (city/state/country) raise Meta's match-quality score.
  const baseEvent = {
    eventSourceUrl: siteUrl ? `${siteUrl}/${product.slug}` : "",
    fbp: v.fbp || fbp || undefined,
    fbc: v.fbc || fbc || undefined,
    ip: ip || undefined,
    userAgent: ua || undefined,
    phone: v.phone,
    city: v.commune.trim(),
    state: wName,
    country: "dz",
    value: total,
    currency: "DZD",
    contentIds: [product.slug],
    contentName: product.title,
    numItems: qty,
  };
  void sendCapi({ ...baseEvent, eventName: "Purchase", eventId: purchaseEventId }).catch(() => {});

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
  void sendTelegram(orderTelegramText(notif)).catch(() => {});
  void appendOrderToSheet([
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
  ]).catch(() => {});

  return NextResponse.json({
    ok: true,
    orderId,
    total,
    shipping,
    subtotal,
    delivery,
  });
}

