import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { saveProduct } from "@/lib/admin-actions";
import { ProductForm } from "../ProductFormFields";
import { PricingFields } from "../PricingFields";

export default async function NewProduct() {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <main className="mx-auto max-w-2xl p-4 pb-16">
      <p className="py-4">
        <Link href="/admin" className="font-bold text-blue-600 underline">
          → رجوع للوحة الإدارة
        </Link>
      </p>
      <h1 className="py-4 text-2xl font-black">منتج جديد + Landing Page</h1>
      <form action={saveProduct} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <span className="mb-1 block text-sm font-bold">اسم المنتج *</span>
            <input name="title" required minLength={2} placeholder="مثال: خلاط كهربائي محمول" className="w-full rounded-xl border px-4 py-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">الرابط (slug)</span>
            <input name="slug" dir="ltr" placeholder="mixeur-portable" className="w-full rounded-xl border px-4 py-3 font-mono" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">عنوان فرعي</span>
            <input name="subtitle" placeholder="توصيل سريع لكل الولايات" className="w-full rounded-xl border px-4 py-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">السعر (دج) *</span>
            <input name="price" type="number" required min={100} placeholder="2900" className="w-full rounded-xl border px-4 py-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">السعر قبل الخصم (دج)</span>
            <input name="oldPrice" type="number" min={0} placeholder="4500" className="w-full rounded-xl border px-4 py-3" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">التقييم (4.8)</span>
            <input name="rating" defaultValue="4.8" className="w-full rounded-xl border px-4 py-3" />
          </label>
          <label className="col-span-2 block">
            <span className="mb-1 block text-sm font-bold">عدد التقييمات</span>
            <input name="reviewsCount" type="number" min={0} defaultValue={127} className="w-full rounded-xl border px-4 py-3" />
          </label>
          <label className="col-span-2 block">
            <span className="mb-1 block text-sm font-bold">نص زر الطلب</span>
            <input name="ctaText" defaultValue="اطلب الآن — الدفع عند الاستلام" className="w-full rounded-xl border px-4 py-3" />
          </label>
          <fieldset className="col-span-2 rounded-xl border p-3">
            <legend className="px-1 text-sm font-bold">نوع الصفحة *</legend>
            <label className="flex items-center gap-2 py-1 font-bold">
              <input type="radio" name="pageType" value="landing" defaultChecked className="h-5 w-5" />
              🚀 صفحة هبوط — صور فقط + زر + استمارة (بدون سعر ولا معلومات)
            </label>
            <label className="flex items-center gap-2 py-1 font-bold">
              <input type="radio" name="pageType" value="product" className="h-5 w-5" />
              📄 صفحة منتج كاملة — سعر + وصف + مميزات + تقييمات
            </label>
          </fieldset>
        </div>

        <PricingFields />

        <ProductForm />

        <label className="block">
          <span className="mb-1 block text-sm font-bold">المميزات (سطر لكل ميزة)</span>
          <textarea name="features" rows={4} placeholder="توصيل سريع لـ58 ولاية&#10;ضمان الجودة&#10;الدفع عند الاستلام" className="w-full rounded-xl border px-4 py-3" />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-bold">الوصف</span>
          <textarea name="description" rows={5} className="w-full rounded-xl border px-4 py-3" />
        </label>

        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" name="active" defaultChecked className="h-5 w-5" /> منشور (Active)
        </label>

        <button className="w-full rounded-2xl bg-black px-6 py-4 font-extrabold text-white">
          حفظ ونشر 🚀
        </button>
      </form>
    </main>
  );
}
