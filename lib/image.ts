import type { ProductImage } from "./schema";

/** Max images per product (admin upload + order of rendering). */
export const MAX_PRODUCT_IMAGES = 20;

/** Raw URL regardless of entry shape. */
export function imgUrl(img: ProductImage): string {
  return typeof img === "string" ? img : img.url;
}

/** Intrinsic dims when known (upload flow records them). Null = unknown. */
export function imgDims(img: ProductImage): { w: number; h: number } | null {
  if (typeof img === "string") return null;
  const w = Number(img.w);
  const h = Number(img.h);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0)
    return { w: Math.round(w), h: Math.round(h) };
  return null;
}

/** Blur-up placeholder (LQIP data URL) when recorded, else undefined. */
export function imgBlur(img: ProductImage): string | undefined {
  if (typeof img === "string") return undefined;
  return typeof img.b === "string" && img.b.startsWith("data:image/")
    ? img.b
    : undefined;
}

/** Slice-group id (tall images split at upload). Empty = standalone. */
export function imgGroup(img: ProductImage): string {
  if (typeof img === "string") return "";
  return typeof img.g === "string" ? img.g : "";
}

export type ImageBlock = { key: string; group: string; items: ProductImage[] };

/**
 * Group consecutive entries sharing a slice-group id into seamless blocks.
 * Standalone images become single-item blocks.
 */
export function groupImages(images: ProductImage[]): ImageBlock[] {
  const blocks: ImageBlock[] = [];
  for (const img of images) {
    if (!imgUrl(img)) continue;
    const g = imgGroup(img);
    const last = blocks[blocks.length - 1];
    if (g && last && last.group === g) {
      last.items.push(img);
    } else {
      blocks.push({ key: `${g || imgUrl(img)}-${blocks.length}`, items: [img], group: g });
    }
  }
  return blocks;
}
