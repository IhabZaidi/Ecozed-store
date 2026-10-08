import { redirect } from "next/navigation";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, orders } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { setOrderStatus, deleteProduct } from "@/lib/admin-actions";

const STATUS_AR: Record<string, string> = {
  draft: "📝 مسودة",
  new: "🆕 جديد",
  confirmed: "✅ مؤكد",
  shipped: "🚚 تم الشحن",
  delivered: "📦 تم التوصيل",
  cancelled: "❌ ملغي",
};

export default async function AdminHome() {
  if (!(await isAdmin())) redirect("/admin/login");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  const allProducts = await db.select().from(products).orderBy(desc(products.id)).limit(100);
  const recentOrders = await db.select().from(orders).orderBy(desc(orders.id)).limit(50);

  return (
    <main className="mx-auto max-w-4xl p-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <h1 className="text-2xl font-black">لوحة الإدارة 🛠️</h1>
        <div className="flex gap-2">
          <Link href="/admin/settings" className="rounded-xl border px-4 py-2 font-bold">
            ⚙️ الإعدادات
          </Link>
          <Link href="/admin/products/new" className="rounded-xl bg-black px-4 py-2 font-bold text-white">
            + منتج جديد
          </Link>
          <LogoutBtn />
        </div>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-extrabold">المنتجات ({allProducts.length})</h2>
        <div className="space-y-2">
          {allProducts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div>
                <p className="font-bold">
                  {p.active ? "🟢" : "⚪"} {p.title}
                  <span className="mr-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                    {(p.pageType ?? "landing") === "product" ? "📄 منتج" : "🚀 هبوط"}
                  </span>
                  <span className="mr-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                    {(p.pricingMode ?? "qty") === "offers" ? "🎁 عروض" : "📦 كمية"}
                  </span>
                  <span className="mr-2 text-sm text-gray-500">{p.price} دج</span>
                </p>
                <p className="text-sm" dir="ltr">
                  <Link href={`/${p.slug}`} className="text-blue-600 underline">
                    /{p.slug}
                  </Link>
                  {siteUrl ? <span className="text-gray-400"> — {siteUrl}/{p.slug}</span> : null}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href={`/admin/products/${p.id}`} className="rounded-lg border px-3 py-1.5 text-sm font-bold">
                  تعديل
                </Link>
                <form action={deleteProduct}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-bold text-red-600">
                    حذف
                  </button>
                </form>
              </div>
            </div>
          ))}
          {allProducts.length === 0 && (
            <p className="rounded-xl bg-gray-50 p-4 text-gray-500">
              لا توجد منتجات بعد. أنشئ أول Landing Page من زر “منتج جديد”.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-extrabold">أحدث الطلبات ({recentOrders.length})</h2>
        <div className="space-y-2">
          {recentOrders.map((o) => (
            <div key={o.id} className="rounded-xl border p-3 text-sm">
              <p className="font-bold">
                #{o.id} — {o.productTitle} × {o.qty} = {o.total} دج
                {(o.shipping ?? 0) > 0 && (
                  <span className="font-normal text-gray-500">
                    {" "}(شامل التوصيل {o.shipping} دج)
                  </span>
                )}
                <span className="mr-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                  {(o.delivery ?? "home") === "stopdesk" ? "🏢 مكتب" : "🏠 منزل"}
                </span>
                <span className="mr-2 rounded-full bg-gray-100 px-2 py-0.5">{STATUS_AR[o.status ?? "new"] ?? o.status}</span>
              </p>
              <p>👤 {o.fullName} — <span dir="ltr">{o.phone}</span></p>
              <p>📍 {o.wilayaName} ({o.wilayaCode}) — {o.commune} {o.address ? `— ${o.address}` : ""}</p>
              <form action={setOrderStatus} className="mt-2 flex gap-2">
                <input type="hidden" name="id" value={o.id} />
                <select name="status" defaultValue={o.status || "new"} className="rounded-lg border px-2 py-1">
                  {Object.entries(STATUS_AR).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <button className="rounded-lg bg-black px-3 py-1 font-bold text-white">حفظ</button>
              </form>
            </div>
          ))}
          {recentOrders.length === 0 && (
            <p className="rounded-xl bg-gray-50 p-4 text-gray-500">لا توجد طلبات بعد.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function LogoutBtn() {
  async function logout() {
    "use server";
    const { destroySession } = await import("@/lib/auth");
    await destroySession();
    redirect("/admin/login");
  }
  return (
    <form action={logout}>
      <button className="rounded-xl border px-4 py-2 font-bold">خروج</button>
    </form>
  );
}
