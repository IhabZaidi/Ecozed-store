import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { settings } from "@/lib/schema";
import { invalidateSettingsCache } from "@/lib/settings";
import { WILAYAS } from "@/lib/wilayas";

export const runtime = "nodejs";

const VALID_CODES = new Set(WILAYAS.map((w) => w.code));

function cleanFee(v: unknown): number | null {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * POST multipart { file: shipping-backup.json } → replaces the shipping table.
 * Accepts our export shape { company, fees: { code: { home, stop } } } plus the
 * legacy flat shape { code: number } (= home). Unknown codes and bad values
 * are skipped; applied count is reported back via ?imported=N.
 */
export async function POST(req: Request) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file || file.size === 0)
    return redirect(req, "fail");
  if (file.size > 1024 * 1024)
    return redirect(req, "fail");

  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return redirect(req, "fail");
  }
  if (!data || typeof data !== "object") return redirect(req, "fail");
  const { company, fees } = data as {
    company?: unknown;
    fees?: unknown;
  };
  if (!fees || typeof fees !== "object" || Array.isArray(fees))
    return redirect(req, "fail");

  const clean: Record<string, { home?: number; stop?: number }> = {};
  for (const [code, v] of Object.entries(fees as Record<string, unknown>)) {
    if (!VALID_CODES.has(code)) continue;
    if (typeof v === "number" || typeof v === "string") {
      const home = cleanFee(v);
      if (home !== null) clean[code] = { home };
    } else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const entry: { home?: number; stop?: number } = {};
      const home = o.home === undefined ? null : cleanFee(o.home);
      const stop = o.stop === undefined ? null : cleanFee(o.stop);
      if (home !== null) entry.home = home;
      if (stop !== null) entry.stop = stop;
      if (Object.keys(entry).length > 0) clean[code] = entry;
    }
  }

  const upsert = (key: string, value: string) =>
    db
      .insert(settings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedAt: new Date() },
      });

  await upsert("shipping_fees", JSON.stringify(clean));
  if (typeof company === "string" && company.trim())
    await upsert("shipping_company", company.trim().slice(0, 100));
  invalidateSettingsCache();

  const url = new URL("/admin/settings", req.url);
  url.searchParams.set("saved", "1");
  url.searchParams.set("tab", "shipping");
  url.searchParams.set("imported", String(Object.keys(clean).length));
  return NextResponse.redirect(url);
}

function redirect(req: Request, why: "fail") {
  const url = new URL("/admin/settings", req.url);
  url.searchParams.set("tab", "shipping");
  url.searchParams.set("import", why);
  return NextResponse.redirect(url);
}
