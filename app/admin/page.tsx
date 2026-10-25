import { redirect } from "next/navigation";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, orders } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { setOrderStatus, deleteOrder } from "@/lib/admin-actions";
import { ProductList } from "./ProductList";
import { OrdersList } from "./ProductList";

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
  const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL) || "";

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

      <ProductList products={allProducts} siteUrl={siteUrl} />

      <OrdersList orders={recentOrders as any} />
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