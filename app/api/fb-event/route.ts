import { NextResponse } from "next/server";
import { z } from "zod";
import { sendCapi, getFbpFbc, clientIp } from "@/lib/fb";

const schema = z.object({
  eventName: z.enum(["InitiateCheckout", "Lead"]),
  eventId: z.string().min(1).max(64),
  slug: z.string().min(1),
  value: z.number().optional(),
});

/** Server-side InitiateCheckout via CAPI (browser fires PageView only). */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { fbp, fbc } = getFbpFbc(req);
  const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL) || "";
  const ua = req.headers.get("user-agent") || "";

  const r = await sendCapi({
    eventName: parsed.data.eventName,
    eventId: parsed.data.eventId,
    eventSourceUrl: siteUrl ? `${siteUrl}/${parsed.data.slug}` : "",
    fbp: fbp || undefined,
    fbc: fbc || undefined,
    ip: clientIp(req) || undefined,
    userAgent: ua || undefined,
    value: parsed.data.value,
    currency: "DZD",
    contentIds: [parsed.data.slug],
    numItems: 1,
  });
  return NextResponse.json({ ok: true, ...r });
}

