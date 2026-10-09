import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders, products } from "@/lib/schema";
import { normalizePhone, dzPhoneRegex } from "@/lib/validation";
import { getShipping, shippingFor } from "@/lib/settings";

// Relaxed on purpose: a draft captures partial info (name + valid phone is
// enough to create). Pricing is best-effort here and recomputed authoritatively
// at submit. NEVER sends events, Telegram or Sheets — drafts are silent.
const draftSchema = z.object({
  slug: z.string().min(1),
  fullName: z.string().trim().max(80).default(""),
  phone: z
    .string()
    .transform(normalizePhone)
    .pipe(z.string().regex(dzPhoneRegex)),
  wilayaCode: z.string().default(""),
  commune: z.string().trim().max(80).default(""),
  address: z.string().trim().max(200).default(""),
  qty: z.coerce.number().int().min(1).max(50).default(1),
  delivery: z.enum(["home", "stopdesk"]).default("home"),
  eventId: z.string().max(64).optional().default(""),
  draftId: z.coerce.number().int().optional(),
  key: z.string().max(64).optional().default(""),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = draftSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "رقم الهاتف غير صحيح" }, { status: 400 });
  const v = parsed.data;

  const rows = await db
    .select()
    .from(products)
    .where(eq(products.slug, v.slug))
    .limit(1);
  const product = rows[0];
  if (!product || !product.active) {
    return NextResponse.json({ error: "المنتج غير متوفر" }, { status: 404 });
  }

  // Tolerant pricing: exact offer when it matches, else unit × qty.
  // Shipping only when a wilaya is known, else 0 (recomputed at submit).
  let subtotal: number;
  let unitPrice = product.price;
  if ((product.pricingMode ?? "qty") === "offers") {
    const list = (product.offers ?? []) as { qty: number; price: number }[];
    const offer = list.find((o) => o.qty === v.qty);
    if (offer) {
      subtotal = offer.price;
      unitPrice = Math.round(offer.price / offer.qty);
    } else {
      subtotal = product.price * v.qty;
    }
  } else {
    subtotal = product.price * v.qty;
  }
  const shipTable = await getShipping();
  const delivery =
    v.delivery === "stopdesk" && shipTable.stopEnabled ? "stopdesk" : "home";
  const shipping = v.wilayaCode
    ? shippingFor(shipTable, v.wilayaCode, delivery)
    : 0;
  const total = subtotal + shipping;

  // Update the same draft (same browser session) instead of spamming rows.
  if (v.draftId && v.key) {
    const existing = await db
      .select()
      .from(orders)
      .where(eq(orders.id, v.draftId))
      .limit(1);
    const d = existing[0];
    if (d && d.status === "draft" && d.fbEventId === v.key) {
      await db
        .update(orders)
        .set({
          qty: v.qty,
          unitPrice,
          shipping,
          delivery,
          total,
          fullName: v.fullName,
          phone: v.phone,
          wilayaCode: v.wilayaCode,
          commune: v.commune,
          address: v.address,
        })
        .where(eq(orders.id, d.id));
      return NextResponse.json({ ok: true, draft: true, orderId: d.id, key: v.key });
    }
  }

  const key =
    v.eventId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const inserted = await db
    .insert(orders)
    .values({
      productId: product.id,
      productSlug: product.slug,
      productTitle: product.title,
      qty: v.qty,
      unitPrice,
      shipping,
      delivery,
      total,
      fullName: v.fullName,
      phone: v.phone,
      wilayaCode: v.wilayaCode,
      commune: v.commune,
      address: v.address,
      notes: "",
      status: "draft",
      fbEventId: key,
      fbp: "",
      fbc: "",
      clientIp: "",
      userAgent: req.headers.get("user-agent") || "",
    })
    .returning({ id: orders.id });

  return NextResponse.json({
    ok: true,
    draft: true,
    orderId: inserted[0]?.id ?? 0,
    key,
  });
}
