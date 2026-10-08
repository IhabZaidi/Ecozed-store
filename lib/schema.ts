import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// Image entry: plain URL, or URL + intrinsic dims (recorded at upload).
// Dims let the landing page render full-bleed WITHOUT cropping or distortion.
// b = tiny blur placeholder (LQIP data URL). g = slice-group id: consecutive
// entries sharing g are parts of one tall image and render seamlessly.
export type ProductImage =
  | string
  | { url: string; w?: number; h?: number; b?: string; g?: string };

/** Pack offer: qty pieces for a fixed price + optional badge label. */
export type ProductOffer = { qty: number; price: number; label?: string };

// One row = one landing page. No storefront.
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle").default(""),
  // "landing" = pictures + button + order form only (no price, no info).
  // "product" = full product page (price, description, reviews...).
  pageType: text("page_type").default("landing"),
  // "qty" = quantity stepper × unit price. "offers" = client picks a pack.
  pricingMode: text("pricing_mode").default("qty"),
  // pack offers [{qty, price}], e.g. [{qty:1,price:2900},{qty:2,price:4900}]
  offers: jsonb("offers").$type<ProductOffer[]>().default([]),
  // prices in DZD (integer, e.g. 2900)
  price: integer("price").notNull(),
  oldPrice: integer("old_price"),
  stock: integer("stock").default(100),
  // compressed webp urls, e.g. ["/uploads/xxx-1.webp"]
  images: jsonb("images").$type<ProductImage[]>().default([]),
  videoUrl: text("video_url").default(""),
  description: text("description").default(""),
  // bullet points shown on landing
  features: jsonb("features").$type<string[]>().default([]),
  rating: text("rating").default("4.8"),
  reviewsCount: integer("reviews_count").default(127),
  ctaText: text("cta_text").default("اطلب الآن — الدفع عند الاستلام"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  productId: integer("product_id"),
  productSlug: text("product_slug").notNull(),
  productTitle: text("product_title").default(""),
  qty: integer("qty").notNull().default(1),
  unitPrice: integer("unit_price").notNull().default(0),
  shipping: integer("shipping").notNull().default(0),
  // "home" = to-home delivery, "stopdesk" = pickup point (company in settings)
  delivery: text("delivery").notNull().default("home"),
  total: integer("total").notNull().default(0),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  wilayaCode: text("wilaya_code").notNull(),
  wilayaName: text("wilaya_name").default(""),
  commune: text("commune").notNull(),
  address: text("address").default(""),
  notes: text("notes").default(""),
  status: text("status").default("new"),
  // FB dedup + attribution
  fbEventId: text("fb_event_id"),
  fbp: text("fbp"),
  fbc: text("fbc"),
  clientIp: text("client_ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Order = typeof orders.$inferSelect;

// Key-value app settings (Facebook Pixel, CAPI token...). Edited in /admin/settings.
// DB values win; env vars are the fallback.
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});
