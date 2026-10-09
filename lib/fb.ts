import { createHash } from "crypto";
import { getFbConfig } from "./settings";

function sha256(v: string) {
  return createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
}

/**
 * Algerian mobile → E.164 digits for Meta matching (0550123456 → 213550123456).
 * Meta requires the country code: national-format hashes match worse.
 */
export function toE164DZ(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("213") && d.length === 12) return d;
  if (d.startsWith("00213") && d.length === 14) return d.slice(2);
  if (d.startsWith("0") && d.length === 10) return "213" + d.slice(1);
  return d;
}

function getCookie(header: string | null, name: string) {
  if (!header) return "";
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

export function getFbpFbc(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  return {
    fbp: getCookie(cookieHeader, "_fbp"),
    fbc: getCookie(cookieHeader, "_fbc"),
  };
}

export function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    ""
  );
}

type CapiArgs = {
  eventName: "PageView" | "ViewContent" | "InitiateCheckout" | "Purchase" | "Lead";
  eventId: string;
  eventSourceUrl: string;
  fbp?: string;
  fbc?: string;
  ip?: string;
  userAgent?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
  numItems?: number;
};

/** Server-side Facebook Conversions API sender. No-op if pixel/token missing. */
export async function sendCapi(a: CapiArgs) {
  const { pixelId, capiToken: token, testCode } = await getFbConfig();
  if (!pixelId || !token) return { skipped: true };

  const user_data: Record<string, string | string[]> = {};
  if (a.fbp) user_data.fbp = a.fbp;
  if (a.fbc) user_data.fbc = a.fbc;
  if (a.ip) user_data.client_ip_address = a.ip;
  if (a.userAgent) user_data.client_user_agent = a.userAgent;
  // hash contact/location data for matching (do NOT send raw)
  const e164 = a.phone ? toE164DZ(a.phone) : "";
  if (e164) user_data.ph = [sha256(e164)];
  if (a.city) user_data.ct = [sha256(a.city)];
  if (a.state) user_data.st = [sha256(a.state)];
  if (a.country) user_data.country = [sha256(a.country)];

  const custom_data: Record<string, unknown> = {};
  if (a.value !== undefined) custom_data.value = a.value;
  if (a.currency) custom_data.currency = a.currency;
  if (a.contentIds) custom_data.content_ids = a.contentIds;
  if (a.contentName) custom_data.content_name = a.contentName;
  if (a.numItems !== undefined) custom_data.num_items = a.numItems;
  if (a.eventName === "ViewContent" || a.eventName === "Purchase")
    custom_data.content_type = "product";

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: a.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: a.eventId,
        event_source_url: a.eventSourceUrl,
        action_source: "website",
        user_data,
        custom_data,
      },
    ],
  };
  if (testCode) payload.test_event_code = testCode;

  // Meta rejects events with no usable identifiers (subcode 2804050).
  // Happens on cookie-less hits without a forwarded IP (e.g. localhost
  // direct, bots) — skip instead of logging a doomed 400.
  if (Object.keys(user_data).length === 0)
    return { skipped: true, reason: "no-user-data" };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      // Never swallow Meta errors: a wrong pixel ID / token shows up here,
      // otherwise Test Events stays empty with zero clues.
      const err = await res.text().catch(() => "");
      console.error("CAPI rejected", res.status, err.slice(0, 300));
    }
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error("CAPI failed", e);
    return { ok: false };
  }
}
