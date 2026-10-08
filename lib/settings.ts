import { db } from "./db";
import { settings } from "./schema";

export type FbConfig = {
  pixelId: string;
  capiToken: string;
  testCode: string;
};

// Short in-memory cache: settings change rarely, but CAPI fires on every
// order — don't add a DB round-trip to the hot path.
let cache: { at: number; rows: Record<string, string> } | null = null;
const TTL_MS = 60_000;

async function loadRows(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.rows;
  let rows: Record<string, string> = {};
  try {
    const all = await db.select().from(settings);
    for (const r of all) rows[r.key] = r.value ?? "";
  } catch {
    // DB unreachable (first boot before migrate) → env fallback below
    rows = {};
  }
  cache = { at: now, rows };
  return rows;
}

export function invalidateSettingsCache() {
  cache = null;
}

/** DB first, env fallback. Pixel ID is safe to expose to the browser. */
export async function getFbConfig(): Promise<FbConfig> {
  const rows = await loadRows();
  return {
    pixelId:
      rows["fb_pixel_id"] ||
      process.env.NEXT_PUBLIC_FB_PIXEL_ID ||
      process.env.FB_PIXEL_ID ||
      "",
    capiToken: rows["fb_capi_token"] || process.env.FB_CAPI_ACCESS_TOKEN || "",
    testCode: rows["fb_test_code"] || process.env.FB_TEST_EVENT_CODE || "",
  };
}

/** Raw values for the admin form (never sent to the browser as-is). */
export async function getRawSettings(keys: string[]) {
  const rows = await loadRows();
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = rows[k] ?? "";
  return out;
}

export type ShippingTable = {
  homeDef: number;
  stopDef: number;
  stopEnabled: boolean;
  company: string;
  home: Record<string, number>;
  stop: Record<string, number>;
};

/** Wilaya shipping fees + defaults, both modes. Server is source of truth. */
export async function getShipping(): Promise<ShippingTable> {
  const rows = await loadRows();
  const num = (v: string | undefined) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  };
  const table: ShippingTable = {
    homeDef: num(rows["shipping_default"]),
    stopDef: num(rows["shipping_stopdesk_default"]),
    // No toggle: stopdesk shows iff any stopdesk fee is above zero.
    stopEnabled: false,
    company: (rows["shipping_company"] ?? "").trim(),
    home: {},
    stop: {},
  };
  // legacy shape {code: fee} = home fees (backward compatible)
  try {
    const parsed: unknown = JSON.parse(rows["shipping_fees"] || "{}");
    if (parsed && typeof parsed === "object") {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === "number" || typeof v === "string") {
          const fee = Math.round(Number(v));
          if (k && Number.isFinite(fee) && fee >= 0) table.home[k] = fee;
        } else if (v && typeof v === "object") {
          const o = v as Record<string, unknown>;
          const h = Math.round(Number(o.home));
          const s = Math.round(Number(o.stop));
          if (k && Number.isFinite(h) && h >= 0) table.home[k] = h;
          if (k && Number.isFinite(s) && s >= 0) table.stop[k] = s;
        }
      }
    }
  } catch {
    /* keep defaults */
  }
  table.stopEnabled =
    table.stopDef > 0 || Object.values(table.stop).some((f) => f > 0);
  return table;
}

export function shippingFor(
  table: ShippingTable,
  wilayaCode: string,
  method: "home" | "stopdesk"
): number {
  const map = method === "stopdesk" ? table.stop : table.home;
  const def = method === "stopdesk" ? table.stopDef : table.homeDef;
  return map[wilayaCode] ?? def;
}

export function deliveryLabel(
  table: ShippingTable,
  method: "home" | "stopdesk"
): string {
  if (method === "stopdesk")
    return table.company ? `مكتب (${table.company})` : "مكتب الاستلام";
  return "المنزل";
}
