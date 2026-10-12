import { createHash } from "crypto";
import { getFbConfig } from "./settings";

/** Graph API version for CAPI. v20.0 was REMOVED by Meta on 2026-09-24
 * ( v21.0 goes 2027-01-21); v25.0 is supported until 2028. Bump this single
 * const when Meta retires it — never hardcode the version at call sites. */
const CAPI_VERSION = "v25.0";

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
  if (!m) return "";
  // A raw % in another cookie's value would throw — never 500 a tracking
  // call over one unreadable cookie.
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

/**
 * Meta diagnostic "server sending modified fbclid in fbc" (Oct 2026):
 * our code forwards the _fbc cookie byte-exact (no transforms anywhere),
 * so a flagged value was already corrupted BEFORE we saw it — the ad URL's
 * fbclid gets lowercased/truncated upstream (in-app browsers, redirect
 * wrappers, domain forwarders), the pixel stores that into _fbc, and we
 * dutifully relay the damage. Sending a corrupted fbc actively hurts
 * attribution; sending NONE just falls back to IP/UA/phone matching.
 * So: validate shape here (single choke point for all CAPI sends) and drop
 * anything that cannot be an authentic Meta-issued value.
 *
 * Authentic _fbc per Meta's docs = fb.<subdomainIndex>.<creationTimeMs>.<fbclid>
 * (e.g. fb.1.1554763741205.AbCdEfGh… — mixed-case, ~61 chars). The code
 * accepts 10+ digit timestamps (tolerance, never strictness) but enforces
 * the documented segment structure.
 * - lowercased fbclid: a 61-char base64url string with ZERO uppercase is
 *   essentially impossible naturally (~(26/64)^61) ⇒ corrupted, drop it.
 * - short fbclid (<40 chars): truncated or fabricated ⇒ drop it.
 */
export function cleanFbc(raw: string): string {
  if (!raw) return "";
  const v = raw.trim();
  // Meta's documented shape: fb.<subdomainIndex>.<creationTimeMs>.<fbclid>
  // with an OPTIONAL 5th appendix segment when the value was built by a
  // parameter-builder library (fb.1.<ts>.<fbclid>.<appendix>). Split-parse
  // so both shapes validate; the fbclid is always the 4th segment.
  const parts = v.split(".");
  const shape =
    (parts.length === 4 || (parts.length === 5 && /^[\w-]+$/.test(parts[4]))) &&
    parts[0] === "fb" &&
    /^\d+$/.test(parts[1]) &&
    /^\d{10,}$/.test(parts[2]);
  const id = shape ? parts[3] : "";
  if (!id || !/^[\w-]+$/.test(id) || id.length < 40) {
    console.error("[fbc-drop] malformed (shape/length):", v.slice(0, 40));
    return "";
  }
  if (/[a-z]/.test(id) && !/[A-Z]/.test(id)) {
    console.error("[fbc-drop] lowercased fbclid (corrupted upstream)");
    return "";
  }
  return v;
}

/** Same hygiene for _fbp (authentic = fb.<idx>.<ts>.<digits>[.<appendix>]). */
export function cleanFbp(raw: string): string {
  if (!raw) return "";
  const v = raw.trim();
  const parts = v.split(".");
  const ok =
    parts.length >= 4 &&
    parts[0] === "fb" &&
    /^\d+$/.test(parts[1]) &&
    /^\d{10,}$/.test(parts[2]) &&
    /^\d+$/.test(parts[3]) &&
    (parts.length === 4 || (parts.length === 5 && /^[\w-]+$/.test(parts[4])));
  if (!ok) {
    console.error("[fbp-drop] malformed:", v.slice(0, 40));
    return "";
  }
  return v;
}

export function getFbpFbc(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  return {
    fbp: cleanFbp(getCookie(cookieHeader, "_fbp")),
    fbc: cleanFbc(getCookie(cookieHeader, "_fbc")),
  };
}

export function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    ""
  );
}

/**
 * Full name → [first, last] for fn/ln matching. Arabic names hash as-is
 * (no case to normalize). Single-token names yield ["token", ""].
 */
export function splitName(fullName: string): [string, string] {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return [parts[0], ""];
  return [parts[0], parts[parts.length - 1]];
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
  firstName?: string;
  lastName?: string;
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
  // Local testing kill-switch: orders still validate + save normally,
  // but nothing leaves the machine (set DISABLE_OUTBOUND=1 in local .env).
  if (process.env.DISABLE_OUTBOUND === "1")
    return { skipped: true, reason: "disabled" };
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
  // external_id: stable per-customer key (guest checkout has no user id, so
  // the E.164 phone doubles as it — Meta recommends external_id on every
  // event). Same hash input ⇒ stable across all of a buyer's events.
  if (e164) user_data.external_id = [sha256(e164)];
  if (a.firstName) user_data.fn = [sha256(a.firstName)];
  if (a.lastName) user_data.ln = [sha256(a.lastName)];
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

  // Meta rejects events with no usable identifiers (subcode 2804050) — and a
  // bare user-agent alone does NOT satisfy it either. Skip unless at least
  // one strong identity signal is present (bots/cookieless probes otherwise
  // burn a 400 on every hit). Happens on localhost direct hits without
  // forwarded IP; production always has x-forwarded-for.
  const STRONG_ID = [
    "fbp",
    "fbc",
    "client_ip_address",
    "ph",
    "em",
    "ct",
    "st",
    "country",
    "external_id",
    "zip",
    "db",
    "ge",
    "ln",
    "fn",
  ];
  if (!STRONG_ID.some((k) => user_data[k]))
    return { skipped: true, reason: "no-identifier" };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${CAPI_VERSION}/${pixelId}/events?access_token=${token}`,
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
