import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { put } from "@vercel/blob";
import { requireAdmin } from "@/lib/admin-guard";

export const runtime = "nodejs";
// Image processing + Blob upload can exceed the 10s Hobby default.
export const maxDuration = 60;

// A tall image is split into independently-loading slices above this height.
// Why: WebP/AVIF don't render progressively — one 3000px file shows NOTHING
// until fully downloaded, while slices paint top-down as they arrive (faster
// LCP + perceived speed). Normal photos are untouched (slicing them would only
// add requests for zero gain).
const SPLIT_THRESHOLD_PX = 1800;
const SLICE_HEIGHT_PX = 900;
const MAX_SLICES = 6;

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
 * Persist a processed file. Vercel serverless has a read-only filesystem,
 * so production uploads go to Vercel Blob; local dev keeps using
 * public/uploads. Same returned URLs shape either way.
 */
async function persist(name: string, buf: Buffer): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    const blob = await put(`uploads/${name}`, buf, {
      access: "public",
      contentType: "image/webp",
      token,
    });
    return blob.url;
  }
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return `/uploads/${name}`;
}

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
    const url = await persist(name, resized);
    return NextResponse.json({
      parts: [
        { url, width: W, height: H, blur: await lqip(resized) },
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
    const url = await persist(name, out);
    parts.push({
      url,
      width: W,
      height: h,
      blur: await lqip(out),
      group,
    });
    bytes += out.length;
  }
  return NextResponse.json({ parts, bytes, split: true });
}
