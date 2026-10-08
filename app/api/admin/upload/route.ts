import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";

export const runtime = "nodejs";

// A tall image is split into independently-loading slices above this height.
// Why: WebP/AVIF don't render progressively — one 3000px file shows NOTHING
// until fully downloaded, while slices paint top-down as they arrive (faster
// LCP + perceived speed). Normal photos are untouched (slicing them would only
// add requests for zero gain).
const SPLIT_THRESHOLD_PX = 1800;
const SLICE_HEIGHT_PX = 900;
const MAX_SLICES = 6;

async function requireAdmin(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!m) return false;
  try {
    await jwtVerify(
      m[1],
      new TextEncoder().encode(
        process.env.ADMIN_SESSION_SECRET || "dev-secret-change-me-please-1234"
      )
    );
    return true;
  } catch {
    return false;
  }
}

/** ~300-byte blur-up placeholder (LQIP) shown while the full file loads. */
async function lqip(buf: Buffer): Promise<string> {
  const tiny = await sharp(buf)
    .resize({ width: 16 })
    .webp({ quality: 30 })
    .toBuffer();
  return `data:image/webp;base64,${tiny.toString("base64")}`;
}

type Part = {
  url: string;
  width: number | null;
  height: number | null;
  blur: string;
  group?: string;
};

/**
 * POST multipart/form-data { file } -> { parts: Part[], bytes, split }
 * Compresses to WebP max 1200px q72 = tiny + fast LCP.
 */
export async function POST(req: Request) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file") as File | null;
  if (!file || file.size === 0)
    return NextResponse.json({ error: "اختر صورة" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: "الصورة أكبر من 5MB" }, { status: 400 });
  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "الملف ليس صورة" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });

  // Strip metadata + resize + WebP = smallest bytes that still look sharp
  const resized = await sharp(buf)
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const W = meta.width ?? 1200;
  const H = meta.height ?? 800;

  if (H <= SPLIT_THRESHOLD_PX) {
    const name = `${base}.webp`;
    await writeFile(path.join(dir, name), resized);
    return NextResponse.json({
      parts: [
        { url: `/uploads/${name}`, width: W, height: H, blur: await lqip(resized) },
      ] satisfies Part[],
      bytes: resized.length,
      split: false,
    });
  }

  // Even slices (no thin sliver at the end): 2752px → 4×688, not 900+900+900+52.
  const n = Math.min(MAX_SLICES, Math.ceil(H / SLICE_HEIGHT_PX));
  const sliceH = Math.ceil(H / n);
  const group = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const parts: Part[] = [];
  let bytes = 0;
  for (let i = 0; i < n; i++) {
    const top = i * sliceH;
    const h = Math.min(sliceH, H - top);
    const out = await sharp(resized)
      .extract({ left: 0, top, width: W, height: h })
      .webp({ quality: 72 })
      .toBuffer();
    const name = `${base}-p${i + 1}.webp`;
    await writeFile(path.join(dir, name), out);
    parts.push({
      url: `/uploads/${name}`,
      width: W,
      height: h,
      blur: await lqip(out),
      group,
    });
    bytes += out.length;
  }
  return NextResponse.json({ parts, bytes, split: true });
}
