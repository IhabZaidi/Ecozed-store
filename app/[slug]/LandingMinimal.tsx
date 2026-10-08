import Image from "next/image";
import type { Product, ProductImage, ProductOffer } from "@/lib/schema";
import type { ShippingTable } from "@/lib/settings";
import { imgUrl, imgDims, imgBlur, groupImages } from "@/lib/image";
import Pixel from "./Pixel";
import OrderForm from "./OrderForm";
import DoneOverlay from "./DoneOverlay";
import StickyCta from "./StickyCta";

type Props = {
  product: Product;
  pixelId: string;
  offers: ProductOffer[];
  shipTable: ShippingTable;
};

/**
 * Minimal landing page: pictures (full, NEVER cropped) + order form.
 * No title, no price, no description, no reviews — nothing but the funnel.
 * (Prices/values are still sent invisibly to Facebook CAPI for ad optimization.)
 *
 * Speed notes:
 * - Tall images arrive pre-split from upload: slices paint top-down instead
 *   of one giant file blocking first paint. Slices of one image (same group)
 *   stack with zero gap via `block` imgs in a single wrapper.
 * - Every image carries a ~300B blur placeholder: instant paint, sharp swap.
 * - Below-fold blocks use content-visibility: browser skips their layout/paint.
 */
export default function LandingMinimal({ product: p, pixelId, offers, shipTable }: Props) {
  const images = (p.images as ProductImage[] | null) ?? [];
  const cta = p.ctaText || "اطلب الآن — الدفع عند الاستلام";
  const blocks = groupImages(images);

  const renderPic = (img: ProductImage, key: string, hero: boolean) => {
    const url = imgUrl(img);
    const dims = imgDims(img);
    const blur = imgBlur(img);
    const blurProps = blur
      ? { placeholder: "blur" as const, blurDataURL: blur }
      : {};
    if (dims) {
      // Exact intrinsic ratio → full-width, zero crop, zero distortion, zero CLS
      return (
        <Image
          key={key}
          src={url}
          alt="صورة المنتج"
          width={dims.w}
          height={dims.h}
          priority={hero}
          fetchPriority={hero ? "high" : undefined}
          loading={hero ? undefined : "lazy"}
          sizes="(max-width: 640px) 100vw, 640px"
          className="block h-auto w-full"
          {...blurProps}
        />
      );
    }
    // Unknown dims (external URL): plain img keeps natural aspect, never cuts
    return (
      // eslint-disable-next-line @next/next/no-img-element -- natural aspect, no crop; next/image needs dims
      <img
        key={key}
        src={url}
        alt="صورة المنتج"
        loading={hero ? "eager" : "lazy"}
        decoding="async"
        {...(hero ? { fetchPriority: "high" as const } : {})}
        className="block h-auto w-full"
      />
    );
  };

  return (
    <>
      <Pixel pixelId={pixelId} />

      <main className="mx-auto max-w-xl pb-28">
        {blocks.map((b, bi) => (
          <div
            key={b.key}
            className={
              bi === 0 ? "overflow-hidden" : "cv-auto mt-3 overflow-hidden"
            }
          >
            {b.items.map((img, i) =>
              // Only the very first slice is the LCP candidate: preloading the
              // whole hero block would let below-fold slices steal its bandwidth.
              renderPic(img, `${b.key}-${i}`, bi === 0 && i === 0)
            )}
          </div>
        ))}

        {/* The form (same width as images + footer button: full max-w-xl) */}
        <section id="order" className="mt-4 scroll-mt-4">
          <OrderForm
            slug={p.slug}
            title={p.title}
            price={p.price}
            ctaText={cta}
            pricingMode={p.pricingMode}
            offers={offers}
            ship={shipTable}
            plainNumbers
          />
        </section>
      </main>

      {/* Sticky bottom CTA: button only, no price — auto-hides at the form */}
      <StickyCta>
        <span className="mx-auto block max-w-xl rounded-xl bg-green-600 px-6 py-3 text-center font-extrabold text-white">
          {cta} 👆
        </span>
      </StickyCta>

      <DoneOverlay plain />
    </>
  );
}
