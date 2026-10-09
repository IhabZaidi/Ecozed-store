import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getShipping } from "@/lib/settings";

export const runtime = "nodejs";

/**
 * GET → downloads the full shipping table as a portable JSON backup:
 * { app, version, exportedAt, company, fees: { code: { home, stop } } }
 * Restore it on any server via the import endpoint — no retyping 116 fees.
 */
export async function GET(req: Request) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const ship = await getShipping();
  const fees: Record<string, { home?: number; stop?: number }> = {};
  for (const code of Object.keys({ ...ship.home, ...ship.stop })) {
    fees[code] = {};
    if (ship.home[code] !== undefined) fees[code].home = ship.home[code];
    if (ship.stop[code] !== undefined) fees[code].stop = ship.stop[code];
  }
  const date = new Date().toISOString().slice(0, 10);
  return NextResponse.json(
    {
      app: "ecozed-store",
      kind: "shipping",
      version: 1,
      exportedAt: new Date().toISOString(),
      company: ship.company,
      fees,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="shipping-backup-${date}.json"`,
      },
    }
  );
}
