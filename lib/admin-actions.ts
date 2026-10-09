"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { products, orders, settings, type ProductImage, type ProductOffer } from "@/lib/schema";
import { MAX_PRODUCT_IMAGES } from "@/lib/image";
import { invalidateSettingsCache } from "@/lib/settings";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function guard() {
  if (!(await isAdmin())) redirect("/admin/login");
}

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, "")
    .replace(/-+/g, "-");
}

function parseList(t: string | null) {
  if (!t) return [];
  return t
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseImagesJson(v: FormDataEntryValue | null): ProductImage[] {
  try {
    const a = JSON.parse(String(v ?? "[]"));
    if (!Array.isArray(a)) return [];
    return a
      .map((it): ProductImage | null => {
        if (typeof it === "string") return it.trim() ? it.trim() : null;
        const url = String(it?.url ?? "").trim();
        if (!url) return null;
        const w = Number(it?.w);
        const h = Number(it?.h);
        const entry: Extract<ProductImage, { url: string }> = { url };
        if (w > 0 && h > 0) {
          entry.w = Math.round(w);
          entry.h = Math.round(h);
        }
        if (
          typeof it?.b === "string" &&
          it.b.startsWith("data:image/") &&
          it.b.length < 12000
        )
          entry.b = it.b;
        if (typeof it?.g === "string" && it.g.length > 0 && it.g.length < 48)
          entry.g = it.g;
        return entry;
      })
      .filter((x): x is ProductImage => x !== null)
      .slice(0, MAX_PRODUCT_IMAGES);
  } catch {
    return [];
  }
}

function num(v: FormDataEntryValue | null, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

async function tinyBlur(buf: Buffer): Promise<string | null> {
  try {
    const tiny = await sharp(buf)
      .resize({ width: 16 })
      .webp({ quality: 30 })
      .toBuffer();
    return `data:image/webp;base64,${tiny.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Fill missing dims/blur for pasted or legacy image URLs (upload flow already
 * records them). Without dims the landing falls back to unsized <img>, which
 * reserves zero space → huge layout shifts (Lighthouse CLS killer).
 * Best-effort with a short timeout: failures keep the plain URL.
 */
async function enrichImageDims(images: ProductImage[]): Promise<ProductImage[]> {
  const probe = async (url: string) => {
    try {
      let buf: Buffer;
      if (url.startsWith("/uploads/")) {
        buf = await readFile(path.join(process.cwd(), "public", url));
      } else if (/^https?:\/\//i.test(url)) {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        if (ab.byteLength > 8 * 1024 * 1024) return null;
        buf = Buffer.from(ab);
      } else {
        return null;
      }
      const meta = await sharp(buf).metadata();
      if (!meta.width || !meta.height) return null;
      return { w: meta.width, h: meta.height, b: await tinyBlur(buf) };
    } catch {
      return null;
    }
  };
  return Promise.all(
    images.map(async (im): Promise<ProductImage> => {
      if (typeof im === "string") {
        const url = im.trim();
        if (!url) return im;
        const dims = await probe(url);
        return dims
          ? { url, w: dims.w, h: dims.h, ...(dims.b ? { b: dims.b } : {}) }
          : url;
      }
      if (!im?.url || imgHasDims(im)) return im;
      const dims = await probe(im.url);
      return dims
        ? { ...im, w: dims.w, h: dims.h, ...(dims.b && !im.b ? { b: dims.b } : {}) }
        : im;
    })
  );
}

function imgHasDims(im: { w?: unknown; h?: unknown }) {
  const w = Number(im.w);
  const h = Number(im.h);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
}

function parseOffers(v: FormDataEntryValue | null): ProductOffer[] {
  try {
    const a = JSON.parse(String(v ?? "[]"));
    if (!Array.isArray(a)) return [];
    const seen = new Set<number>();
    return a
      .map((it): ProductOffer | null => {
        const qty = Math.round(Number(it?.qty));
        const price = Math.round(Number(it?.price));
        if (!Number.isFinite(qty) || qty < 1 || qty > 50) return null;
        if (!Number.isFinite(price) || price < 100) return null;
        if (seen.has(qty)) return null;
        seen.add(qty);
        const label = String(it?.label ?? "").trim().slice(0, 40);
        return { qty, price, ...(label ? { label } : {}) };
      })
      .filter((x): x is ProductOffer => x !== null)
      .sort((x, y) => x.qty - y.qty)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export async function saveProduct(formData: FormData) {
  await guard();
  const id = Number(formData.get("id") || 0);
  const title = String(formData.get("title") || "").trim();
  if (title.length < 2) throw new Error("أدخل اسم المنتج");
  let slug =
    String(formData.get("slug") || "").trim() || slugify(title);
  slug = slugify(slug);
  if (!slug) throw new Error("الرابط (slug) غير صالح");

  const pricingMode =
    String(formData.get("pricingMode") || "qty") === "offers"
      ? "offers"
      : "qty";
  const offers = pricingMode === "offers" ? parseOffers(formData.get("offersJson")) : [];
  if (pricingMode === "offers" && offers.length === 0)
    throw new Error("أضف عرضًا واحدًا على الأقل (الكمية + السعر)");

  const values = {
    slug,
    title,
    subtitle: String(formData.get("subtitle") || "").trim(),
    pageType:
      String(formData.get("pageType") || "landing") === "product"
        ? "product"
        : "landing",
    price: num(formData.get("price")),
    oldPrice: num(formData.get("oldPrice")) || null,
    images: await enrichImageDims(parseImagesJson(formData.get("imagesJson"))),
    pricingMode,
    offers,
    videoUrl: String(formData.get("videoUrl") || "").trim(),
    description: String(formData.get("description") || ""),
    features: parseList(String(formData.get("features") || "")),
    rating: String(formData.get("rating") || "4.8"),
    reviewsCount: num(formData.get("reviewsCount"), 127),
    ctaText:
      String(formData.get("ctaText") || "").trim() ||
      "اطلب الآن — الدفع عند الاستلام",
    active: formData.get("active") === "on",
    updatedAt: new Date(),
  };
  if (!values.price || values.price < 100)
    throw new Error("السعر غير صالح");

  if (id) {
    await db.update(products).set(values).where(eq(products.id, id));
  } else {
    await db.insert(products).values(values);
  }
  revalidatePath(`/${slug}`);
  redirect("/admin");
}

export async function deleteProduct(formData: FormData) {
  await guard();
  const id = Number(formData.get("id") || 0);
  if (id) await db.delete(products).where(eq(products.id, id));
  redirect("/admin");
}

export async function setOrderStatus(formData: FormData) {
  await guard();
  const id = Number(formData.get("id") || 0);
  const status = String(formData.get("status") || "new");
  if (id) await db.update(orders).set({ status }).where(eq(orders.id, id));
  redirect("/admin");
}

async function upsertSetting(key: string, value: string) {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    });
}

const PIXEL_KEYS = ["fb_pixel_id", "fb_capi_token", "fb_test_code"] as const;
const TELEGRAM_KEYS = ["tg_bot_token", "tg_chat_id"] as const;
const SHEETS_KEYS = [
  "gs_spreadsheet_id",
  "gs_client_email",
  "gs_private_key",
  "gs_tab",
] as const;

export async function savePixelSettings(formData: FormData) {
  await guard();
  for (const key of PIXEL_KEYS) {
    await upsertSetting(key, String(formData.get(key) ?? "").trim());
  }
  invalidateSettingsCache();
  redirect("/admin/settings?saved=1&tab=pixel");
}

export async function saveTelegramSettings(formData: FormData) {
  await guard();
  for (const key of TELEGRAM_KEYS) {
    await upsertSetting(key, String(formData.get(key) ?? "").trim());
  }
  invalidateSettingsCache();
  redirect("/admin/settings?saved=1&tab=telegram");
}

export async function saveSheetsSettings(formData: FormData) {
  await guard();
  for (const key of SHEETS_KEYS) {
    await upsertSetting(key, String(formData.get(key) ?? "").trim());
  }
  invalidateSettingsCache();
  redirect("/admin/settings?saved=1&tab=sheets");
}

export async function saveShippingSettings(formData: FormData) {
  await guard();
  for (const key of ["shipping_company"] as const) {
    await upsertSetting(key, String(formData.get(key) ?? "").trim());
  }
  // defaults removed: per-wilaya fees only, empty = free (0). Clear stale keys.
  await db.delete(settings).where(eq(settings.key, "shipping_default"));
  await db.delete(settings).where(eq(settings.key, "shipping_stopdesk_default"));
  // wilaya shipping fees: inputs named home_<code> / stop_<code>
  // → one JSON setting {code: {home, stop}}. Empty input = use default.
  const fees: Record<string, { home?: number; stop?: number }> = {};
  for (const [k, v] of formData.entries()) {
    let code = "";
    let kind: "home" | "stop" | "" = "";
    if (k.startsWith("home_")) {
      code = k.slice(5);
      kind = "home";
    } else if (k.startsWith("stop_")) {
      code = k.slice(5);
      kind = "stop";
    } else {
      continue;
    }
    const raw = String(v).trim();
    if (!code || !kind || raw === "") continue;
    const fee = Math.round(Number(raw));
    if (!Number.isFinite(fee) || fee < 0) continue;
    fees[code] = { ...(fees[code] ?? {}), [kind]: fee };
  }
  await upsertSetting("shipping_fees", JSON.stringify(fees));
  // legacy toggle key no longer used (stopdesk shows iff a fee > 0) — remove it
  await db.delete(settings).where(eq(settings.key, "shipping_stopdesk_enabled"));
  invalidateSettingsCache();
  redirect("/admin/settings?saved=1&tab=shipping");
}

export async function testTelegram() {
  await guard();
  const { sendTelegram } = await import("@/lib/telegram");
  const r = await sendTelegram("✅ بوت Ecozed يعمل! ستصلك إشعارات الطلبات هنا.");
  redirect(
    r.ok
      ? "/admin/settings?saved=1&tab=telegram&tgtest=ok"
      : "/admin/settings?saved=1&tab=telegram&tgtest=fail"
  );
}
