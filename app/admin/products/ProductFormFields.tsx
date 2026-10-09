"use client";

import { useState } from "react";
import type { Product, ProductImage } from "@/lib/schema";
import { imgUrl, MAX_PRODUCT_IMAGES } from "@/lib/image";

type Item = { url: string; w?: number; h?: number; b?: string; g?: string };

function clean(raw: {
  url?: unknown;
  w?: unknown;
  h?: unknown;
  b?: unknown;
  g?: unknown;
}): Item | null {
  const url = String(raw?.url ?? "").trim();
  if (!url) return null;
  const item: Item = { url };
  const w = Number(raw?.w);
  const h = Number(raw?.h);
  if (w > 0 && h > 0) {
    item.w = Math.round(w);
    item.h = Math.round(h);
  }
  if (
    typeof raw?.b === "string" &&
    raw.b.startsWith("data:image/") &&
    raw.b.length < 12000
  )
    item.b = raw.b;
  if (typeof raw?.g === "string" && raw.g.length > 0 && raw.g.length < 48)
    item.g = raw.g;
  return item;
}

function toItems(images: ProductImage[] | null | undefined): Item[] {
  if (!images) return [];
  return images
    .map((im): Item | null =>
      typeof im === "string" ? clean({ url: im }) : clean(im)
    )
    .filter((x): x is Item => x !== null)
    .slice(0, MAX_PRODUCT_IMAGES);
}

export function ProductForm({ initial }: { initial?: Product | null }) {
  const [items, setItems] = useState<Item[]>(() =>
    toItems(initial?.images as ProductImage[] | null)
  );
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const [urlInput, setUrlInput] = useState("");

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setMsg("");
    try {
      const batch = Array.from(files).slice(0, MAX_PRODUCT_IMAGES - items.length);
      const next: Item[] = [];
      for (let i = 0; i < batch.length; i++) {
        setMsg(`جارٍ الرفع ${i + 1}/${batch.length}…`);
        const fd = new FormData();
        fd.append("file", batch[i]);
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: fd,
        });
        // 500 pages on some hosts are HTML, not JSON — never show parser errors
        const data = await res.json().catch(() => null);
        if (!res.ok)
          throw new Error(
            (data as { error?: string } | null)?.error ||
              "فشل الرفع (خطأ في الخادم، تحقق من الإعدادات)"
          );
        // tall images come back split into seamless parts (+ blur placeholders)
        const parts = Array.isArray(data.parts) ? data.parts : [];
        for (const p of parts) {
          const item = clean(p);
          if (item) next.push(item);
        }
        if (parts.length === 0) throw new Error("استجابة رفع غير صالحة");
      }
      setItems((prev) => [...prev, ...next].slice(0, MAX_PRODUCT_IMAGES));
      setMsg(`تم رفع ${next.length} صورة (WebP مضغوطة) ✅`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "فشل الرفع");
    } finally {
      setUploading(false);
    }
  }

  function addUrl() {
    const u = urlInput.trim();
    if (!u || items.length >= MAX_PRODUCT_IMAGES) return;
    setItems((prev) => [...prev, { url: u }]);
    setUrlInput("");
  }

  function removeAt(i: number) {
    setItems((prev) => prev.filter((_, x) => x !== i));
  }

  return (
    <div className="space-y-3">
      {/* serialized for the server action */}
      <input type="hidden" name="imagesJson" value={JSON.stringify(items)} />

      <div className="rounded-2xl border border-dashed p-4">
        <p className="text-sm font-bold">
          📸 صور المنتج ({items.length}/{MAX_PRODUCT_IMAGES}) — تُضغط تلقائيًا إلى WebP
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={uploading || items.length >= MAX_PRODUCT_IMAGES}
          onChange={(e) => upload(e.target.files)}
          className="mt-2 w-full text-sm"
        />
        <div className="mt-2 flex gap-2">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            dir="ltr"
            placeholder="https://… (رابط صورة خارجي)"
            className="flex-1 rounded-xl border px-3 py-2 font-mono text-sm"
          />
          <button
            type="button"
            onClick={addUrl}
            className="rounded-xl border px-4 py-2 text-sm font-bold"
          >
            إضافة
          </button>
        </div>
        {msg && <p className="mt-1 text-sm text-gray-600">{msg}</p>}
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {items.map((it, i) => (
            <div
              key={`${it.url}-${i}`}
              className="relative overflow-hidden rounded-xl border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl(it)}
                alt={`صورة ${i + 1}`}
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="حذف الصورة"
                className="absolute left-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
