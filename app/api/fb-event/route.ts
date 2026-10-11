import { NextResponse } from "next/server";
import { z } from "zod";
import { sendCapi, getFbpFbc, clientIp, splitName } from "@/lib/fb";

const schema = z.object({
  eventName: z.enum(["PageView", "InitiateCheckout", "Lead"]),
  eventId: z.string().min(1).max(64),
  slug: z.string().min(1),
  value: z.number().optional(),
  // Optional identity signals for EMQ (hashed server-side in sendCapi).
  // InitiateCheckout fires right after a validated order save, so the buyer
  // data is available — same match quality as Purchase.
  phone: z.string().max(32).optional().default(""),
  fullName: z.string().max(80).optional().default(""),
  city: z.string().max(80).optional().default(""),
  state: z.string().max(80).optional().default(""),
  country: z.string().max(8).optional().default(""),
});

/**
 * Server-side CAPI twins for idle browser hooks (keeps the landing ISR-cached:
 * reading cookies/headers in the page would force dynamic rendering).
 * - PageView: called by the Pixel with the SAME event_id the browser used in
 *   fbq('track', …, {eventID}) → Meta dedups the pair (same name + same ID =
 *   counted once) and CAPI coverage for PageView goes to ~100%. Ad-blocked
 *   browsers contribute the server event alone — still counted once.
 * - ViewContent: called by the Pixel at idle with a fresh ID (no browser twin
 *   exists, so each view is exactly one event) with first-party identifiers.
 */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { fbp, fbc } = getFbpFbc(req);
  const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL) || "";
  // No trailing slash: SITE_URL="https://shop.com/" + "/slug" would send a
  // double-slash event_source_url and hurt URL matching quality.
  const pageUrl = siteUrl ? `${siteUrl.replace(/\/+$/, "")}/${parsed.data.slug}` : "";
  const ua = req.headers.get("user-agent") || "";
  const [firstName, lastName] = splitName(parsed.data.fullName);

  const r = await sendCapi({
    eventName: parsed.data.eventName,
    eventId: parsed.data.eventId,
    eventSourceUrl: pageUrl,
    fbp: fbp || undefined,
    fbc: fbc || undefined,
    ip: clientIp(req) || undefined,
    userAgent: ua || undefined,
    phone: parsed.data.phone || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    city: parsed.data.city || undefined,
    state: parsed.data.state || undefined,
    country: parsed.data.country || undefined,
    value: parsed.data.value,
    currency: "DZD",
    contentIds: [parsed.data.slug],
    numItems: 1,
  });
  return NextResponse.json({ ok: true, ...r });
}

