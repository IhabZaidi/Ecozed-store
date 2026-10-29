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
      <form action={saveProduct} className="space-y-6">
        {/* Basic Info */}
        <fieldset className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
          <legend className="text-sm font-bold text-gray-900">معلومات المنتج الأساسية</legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700">اسم المنتج *</span>
              <input
                name="title"
                required
                minLength={2}
                placeholder="مثال: خلاط كهربائي محمول"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-black focus:outline-none"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700">الرابط (slug)</span>
              <input
                name="slug"
                dir="ltr"
                placeholder="mixeur-portable"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-black focus:outline-none"
              />
              <span className="text-xs text-gray-500">يترك فارغًا = يُنشأ تلقائيًا من الاسم</span>
            </label>

            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-gray-700">عنوان فرعي</span>
              <input
                name="subtitle"
                placeholder="توصيل سريع لكل الولايات"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-black focus:outline-none"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700">السعر (دج) *</span>
              <input
                name="price"
                type="number"
                required
                min={100}
                placeholder="2900"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-black focus:outline-none"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700">السعر قبل الخصم (دج)</span>
              <input
                name="oldPrice"
                type="number"
                min={0}
                placeholder="4500"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-black focus:outline-none"
              />
              <span className="text-xs text-gray-500">اتركه فارغًا إذا لا يوجد خصم</span>
            </label>
          </div>
        </fieldset>

        {/* Page Type & Display */}
        <fieldset className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
          <legend className="text-sm font-bold text-gray-900">نوع الصفحة وخيارات العرض</legend>

          <div className="space-y-3">
            <label className="flex items-center gap-2 py-2">
              <input
                type="radio"
                name="pageType"
                value="landing"
                defaultChecked
                className="h-5 w-5 accent-black"
              />
              <span className="font-medium">🚀 صفحة هبوط</span>
              <span className="text-sm text-gray-500">— صور فقط + زر + استمارة (بدون سعر ولا معلومات)</span>
            </label>
            <label className="flex items-center gap-2 py-2">
              <input
                type="radio"
                name="pageType"
                value="product"
                className="h-5 w-5 accent-black"
              />
              <span className="font-medium">📄 صفحة منتج كاملة</span>
              <span className="text-sm text-gray-500">— سعر + وصف + مميزات + تقييمات</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700">التقييم</span>
              <input
                name="rating"
                defaultValue="4.8"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-black focus:outline-none"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700">عدد التقييمات</span>
              <input
                name="reviewsCount"
                type="number"
                min={0}
                defaultValue={127}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-black focus:outline-none"
              />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">نص زر الطلب</span>
            <input
              name="ctaText"
              defaultValue="اطلب الآن — الدفع عند الاستلام"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-black focus:outline-none"
            />
          </label>
        </fieldset>

        {/* Pricing Fields */}
        <PricingFields />

        {/* Product Images */}
        <ProductForm />

        {/* Content */}
        <fieldset className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
          <legend className="text-sm font-bold text-gray-900">المحتوى</legend>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">المميزات (سطر لكل ميزة)</span>
            <textarea
              name="features"
              rows={4}
              placeholder="توصيل سريع لـ58 ولاية&#10;ضمان الجودة&#10;الدفع عند الاستلام"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-black focus:outline-none font-mono text-sm"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">الوصف</span>
            <textarea
              name="description"
              rows={5}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-black focus:outline-none"
            />
          </label>
        </fieldset>

        {/* Options */}
        <fieldset className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <legend className="text-sm font-bold text-gray-900">خيارات إضافية</legend>

          <label className="flex items-center gap-2 py-1">
            <input type="checkbox" name="active" defaultChecked className="h-5 w-5 accent-black" />
            <span className="font-medium">منشور (Active)</span>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">رابط فيديو يوتيوب (اختياري)</span>
            <input
              name="videoUrl"
              dir="ltr"
              placeholder="https://youtube.com/watch?v=... أو https://youtu.be/..."
              className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm focus:border-black focus:outline-none"
            />
            <p className="text-xs text-gray-500">يظهر قبل استمارة الطلب في صفحة الهبوط</p>
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 font-medium text-gray-800">
            <input type="checkbox" name="showTopBar" defaultChecked className="h-5 w-5 accent-black" />
            <span>📦 الشريط العلوي (افتح الطلبية وتأكد من الجودة وبعدها خلص)</span>
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 font-medium text-gray-800">
            <input type="checkbox" name="showWhatsApp" defaultChecked className="h-5 w-5 accent-black" />
            <span>💬 زر واتساب للتواصل السريع</span>
          </label>
        </fieldset>

        <button className="w-full rounded-2xl bg-black px-6 py-3.5 font-bold text-white hover:bg-gray-900 transition">
          حفظ ونشر 🚀
        </button>
      </form>
    </main>
  );
}
