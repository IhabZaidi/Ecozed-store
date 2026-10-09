import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, type ProductImage, type ProductOffer } from "@/lib/schema";
import { getFbConfig, getShipping } from "@/lib/settings";
import { imgUrl, imgBlur, imgDims, groupImages } from "@/lib/image";
import { sendCapi } from "@/lib/fb";
import Pixel from "./Pixel";
import OrderForm from "./OrderForm";
import LandingMinimal from "./LandingMinimal";
import DoneOverlay from "./DoneOverlay";
import StickyCta from "./StickyCta";

export const revalidate = 60; // ISR: fast cached HTML, fresh prices within a minute
export const dynamicParams = true;

async function getProduct(slug: string) {
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  const p = rows[0];
  if (!p || !p.active) return null;
  return p;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p)
    return { title: "المنتج غير موجود | Ecozed", robots: { index: false } };
  const img = imgUrl((p.images as ProductImage[] | null)?.[0] ?? "");
  return {
    title: `${p.title} | اطلب الآن — الدفع عند الاستلام`,
    description: p.subtitle || p.description?.slice(0, 150) || p.title,
    openGraph: {
      title: p.title,
      description: p.subtitle || undefined,
      type: "website",
      ...(img ? { images: [{ url: img }] } : {}),
    },
    robots: { index: true, follow: true },
  };
}

function discountPct(price: number, old?: number | null) {
  if (!old || old <= price) return 0;
  return Math.round((1 - price / old) * 100);
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) notFound();

  const images = (p.images as ProductImage[] | null) ?? [];
  const heroBlur = images[0] ? imgBlur(images[0]) : undefined;
  const galleryBlocks = groupImages(images.slice(1));
  const features = (p.features as string[] | null) ?? [];
  const pct = discountPct(p.price, p.oldPrice);
  const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL) || "";
  // Per-request unique ID for the server ViewContent (CAPI) event.
  // Impure by necessity (a Server Component renders once per request).
  // eslint-disable-next-line react-hooks/purity
  const eventId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  // Server-side ViewContent (CAPI). Fire-and-forget: never block the HTML.
  void sendCapi({
    eventName: "ViewContent",
    eventId,
    eventSourceUrl: siteUrl ? `${siteUrl}/${slug}` : "",
    value: p.price,
    currency: "DZD",
    contentIds: [slug],
    contentName: p.title,
    numItems: 1,
  }).catch(() => {});

  const pixelId = (await getFbConfig()).pixelId;
  const shipTable = await getShipping();
  const offers = (p.offers as ProductOffer[] | null) ?? [];

  // Minimal landing: pictures + button + order form only. No price, no info.
  if ((p.pageType ?? "landing") !== "product") {
    return (
      <LandingMinimal
        product={p}
        pixelId={pixelId}
        offers={offers}
        shipTable={shipTable}
      />
    );
  }

  return (
    <>
      <Pixel pixelId={pixelId} />

      <main className="mx-auto max-w-xl px-4 pb-28">
        {/* Title */}
        <header className="pt-4 text-center">
          <h1 className="text-2xl font-black leading-snug">{p.title}</h1>
          {p.subtitle ? (
            <p className="mt-1 text-gray-600">{p.subtitle}</p>
          ) : null}
          <div className="mt-2 flex items-center justify-center gap-2 text-sm">
            <span className="text-yellow-500">{"★".repeat(5)}</span>
            <span className="font-bold">{p.rating}</span>
            <span className="text-gray-500">
              ({p.reviewsCount} تقييم)
            </span>
          </div>
        </header>

        {/* Hero image: priority + fetchPriority = fastest LCP */}
        {images[0] ? (
          <div className="relative mt-6">
            {pct > 0 && (
              <span className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-600 px-4 py-1.5 text-sm font-extrabold text-white shadow-lg">
                خصم {pct}%
              </span>
            )}
            <Image
              src={imgUrl(images[0])}
              alt={p.title}
              width={800}
              height={800}
              priority
              fetchPriority="high"
              sizes="(max-width: 640px) 100vw, 640px"
              className="aspect-square w-full rounded-2xl object-cover"
              {...(heroBlur
                ? { placeholder: "blur" as const, blurDataURL: heroBlur }
                : {})}
            />
          </div>
        ) : null}

        {/* Price card */}
        <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl bg-gray-50 p-4">
          <span className="text-3xl font-black text-green-700">
            {p.price.toLocaleString("ar-DZ")} دج
          </span>
          {p.oldPrice && p.oldPrice > p.price ? (
            <span className="text-lg text-gray-400 line-through">
              {p.oldPrice.toLocaleString("ar-DZ")} دج
            </span>
          ) : null}
        </div>

        {/* Extra gallery: lazy by default, blur-up, slice groups seamless */}
        {galleryBlocks.map((b, bi) => {
          if (b.items.length === 1) {
            const blur = imgBlur(b.items[0]);
            return (
              <div
                key={b.key}
                className="cv-auto relative mt-3 overflow-hidden rounded-2xl"
              >
                <Image
                  src={imgUrl(b.items[0])}
                  alt={`${p.title} - صورة ${bi + 2}`}
                  width={800}
                  height={800}
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw, 640px"
                  className="aspect-square w-full object-cover"
                  {...(blur
                    ? { placeholder: "blur" as const, blurDataURL: blur }
                    : {})}
                />
              </div>
            );
          }
          return (
            <div
              key={b.key}
              className="cv-auto relative mt-3 overflow-hidden rounded-2xl"
            >
              {b.items.map((img, i) => {
                const dims = imgDims(img);
                const blur = imgBlur(img);
                if (!dims) return null;
                return (
                  <Image
                    key={`${b.key}-${i}`}
                    src={imgUrl(img)}
                    alt={`${p.title} - صورة ${bi + 2}`}
                    width={dims.w}
                    height={dims.h}
                    loading="lazy"
                    sizes="(max-width: 640px) 100vw, 640px"
                    className="-mb-px block h-auto w-full"
                    {...(blur
                      ? { placeholder: "blur" as const, blurDataURL: blur }
                      : {})}
                  />
                );
              })}
            </div>
          );
        })}

        {/* Features */}
        {features.length > 0 && (
          <section className="mt-6 rounded-2xl border border-gray-200 p-5">
            <h2 className="mb-3 text-lg font-extrabold">
              ✨ لماذا ستحب هذا المنتج؟
            </h2>
            <ul className="space-y-2">
              {features.map((f, i) => (
                <li key={i} className="flex gap-2 text-[15px]">
                  <span className="text-green-600">✔</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Description */}
        {p.description ? (
          <section className="mt-4 rounded-2xl border border-gray-200 p-5">
            <h2 className="mb-2 text-lg font-extrabold">📋 الوصف</h2>
            <p className="whitespace-pre-line text-[15px] leading-7 text-gray-700">
              {p.description}
            </p>
          </section>
        ) : null}

        {/* COD trust strip */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold text-gray-700">
          <div className="rounded-xl bg-gray-50 p-3">
            💵
            <br />
            الدفع عند الاستلام
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            🚚
            <br />
            توصيل لكل الولايات
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            📞
            <br />
            تأكيد هاتفي سريع
          </div>
        </div>

        {/* Order form */}
        <section id="order" className="mt-6 scroll-mt-4">
          <OrderForm
            slug={p.slug}
            title={p.title}
            price={p.price}
            ctaText={p.ctaText || "اطلب الآن — الدفع عند الاستلام"}
            pricingMode={p.pricingMode}
            offers={offers}
            ship={shipTable}
          />
        </section>
      </main>

      {/* Sticky bottom CTA: auto-hides while the form is visible */}
      <StickyCta>
        <span className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <span className="font-black">
            {p.price.toLocaleString("ar-DZ")} دج{" "}
            {p.oldPrice && p.oldPrice > p.price ? (
              <span className="text-sm font-normal text-gray-400 line-through">
                {p.oldPrice.toLocaleString("ar-DZ")}
              </span>
            ) : null}
          </span>
          <span className="rounded-xl bg-green-700 px-6 py-3 font-extrabold text-white">
            اطلب الآن 👆
          </span>
        </span>
      </StickyCta>

      <DoneOverlay />
    </>
  );
}
