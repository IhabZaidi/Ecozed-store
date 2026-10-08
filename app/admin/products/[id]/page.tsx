import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { saveProduct } from "@/lib/admin-actions";
import { ProductForm } from "../ProductFormFields";
import { PricingFields } from "../PricingFields";

export default async function EditProduct({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { id } = await params;
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.id, Number(id)))
    .limit(1);
  const p = rows[0];
  if (!p) notFound();

  const features = ((p.features as string[] | null) ?? []).join("\n");

  return (
    <main className="mx-auto max-w-2xl p-4 pb-16">
      <p className="py-4">
        <Link href="/admin" className="font-bold text-blue-600 underline">
          → رجوع للوحة الإدارة
        </Link>
      </p>
      <h1 className="py-4 text-2xl font-black">تعديل: {p.title}</h1>
      <form action={saveProduct} className="space-y-4">
        <input type="hidden" name="id" value={p.id} />
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <span className="mb-1 block text-sm font-bold">اسم المنتج *</span>
            <input name="title" required defaultValue={p.title} className="w-full rounded-xl border px-4 py-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">الرابط (slug)</span>
            <input name="slug" dir="ltr" defaultValue={p.slug} className="w-full rounded-xl border px-4 py-3 font-mono" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">عنوان فرعي</span>
            <input name="subtitle" defaultValue={p.subtitle || ""} className="w-full rounded-xl border px-4 py-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">السعر (دج) *</span>
            <input name="price" type="number" required defaultValue={p.price} className="w-full rounded-xl border px-4 py-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">السعر قبل الخصم</span>
            <input name="oldPrice" type="number" defaultValue={p.oldPrice || ""} className="w-full rounded-xl border px-4 py-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">التقييم</span>
            <input name="rating" defaultValue={p.rating || "4.8"} className="w-full rounded-xl border px-4 py-3" />
          </label>
          <label className="col-span-2 block">
            <span className="mb-1 block text-sm font-bold">عدد التقييمات</span>
            <input name="reviewsCount" type="number" defaultValue={p.reviewsCount || 127} className="w-full rounded-xl border px-4 py-3" />
          </label>
          <label className="col-span-2 block">
            <span className="mb-1 block text-sm font-bold">نص زر الطلب</span>
            <input name="ctaText" defaultValue={p.ctaText || ""} className="w-full rounded-xl border px-4 py-3" />
          </label>
          <fieldset className="col-span-2 rounded-xl border p-3">
            <legend className="px-1 text-sm font-bold">نوع الصفحة *</legend>
            <label className="flex items-center gap-2 py-1 font-bold">
              <input type="radio" name="pageType" value="landing" defaultChecked={(p.pageType ?? "landing") !== "product"} className="h-5 w-5" />
              🚀 صفحة هبوط — صور فقط + زر + استمارة (بدون سعر ولا معلومات)
            </label>
            <label className="flex items-center gap-2 py-1 font-bold">
              <input type="radio" name="pageType" value="product" defaultChecked={p.pageType === "product"} className="h-5 w-5" />
              📄 صفحة منتج كاملة — سعر + وصف + مميزات + تقييمات
            </label>
          </fieldset>
        </div>

        <PricingFields
          initialMode={p.pricingMode}
          initialOffers={(p.offers as { qty: number; price: number }[] | null) ?? []}
        />

        <ProductForm initial={p} />

        <label className="block">
          <span className="mb-1 block text-sm font-bold">المميزات (سطر لكل ميزة)</span>
          <textarea name="features" rows={4} defaultValue={features} className="w-full rounded-xl border px-4 py-3" />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-bold">الوصف</span>
          <textarea name="description" rows={5} defaultValue={p.description || ""} className="w-full rounded-xl border px-4 py-3" />
        </label>

        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" name="active" defaultChecked={!!p.active} className="h-5 w-5" /> منشور (Active)
        </label>

        <button className="w-full rounded-2xl bg-black px-6 py-4 font-extrabold text-white">
          حفظ التعديلات 💾
        </button>
      </form>
    </main>
  );
}
