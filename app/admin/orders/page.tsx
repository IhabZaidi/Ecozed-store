import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, count, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, orders } from "@/lib/schema";
import { isAdmin } from "@/lib/auth";
import { setOrderStatus, deleteOrder } from "@/lib/admin-actions";
import { OrdersList } from "../ProductList";

const ORDERS_PER_PAGE = 20;

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const { page: pageParam, status: statusParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10));
  const statusFilter = statusParam || "all";

  // Fetch total count for pagination
  const [{ total: totalOrders }] = await db
    .select({ total: count() })
    .from(orders)
    .where(
      statusFilter === "all"
        ? undefined
        : sql`${orders.status} = ${statusFilter}`
    );

  // Fetch paginated orders
  const recentOrders = await db
    .select()
    .from(orders)
    .where(
      statusFilter === "all"
        ? undefined
        : sql`${orders.status} = ${statusFilter}`
    )
    .orderBy(desc(orders.id))
    .limit(ORDERS_PER_PAGE)
    .offset((page - 1) * ORDERS_PER_PAGE);

  const totalPages = Math.ceil(totalOrders / ORDERS_PER_PAGE);

  // Fetch products for filter
  const allProducts = await db.select().from(products).orderBy(desc(products.id)).limit(100);

  const STATUS_AR: Record<string, string> = {
    all: "الكل",
    draft: "📝 مسودة",
    new: "🆕 جديد",
    confirmed: "✅ مؤكد",
    shipped: "🚚 تم الشحن",
    delivered: "📦 تم التوصيل",
    cancelled: "❌ ملغي",
  };

  const STATUS_COLOR: Record<string, string> = {
    all: "bg-gray-100 text-gray-700",
    draft: "bg-gray-100 text-gray-700",
    new: "bg-blue-50 text-blue-700",
    confirmed: "bg-green-50 text-green-700",
    shipped: "bg-amber-50 text-amber-700",
    delivered: "bg-emerald-50 text-emerald-700",
    cancelled: "bg-red-50 text-red-700",
  };

  return (
    <main className="mx-auto max-w-6xl p-4 pb-16">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b">
        <div>
          <h1 className="text-2xl font-black tracking-tight">الطلبات</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            إدارة وعرض جميع الطلبات ({totalOrders} طلب)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="rounded-xl border px-4 py-2 font-medium text-sm hover:bg-gray-50 transition">
            ← العودة للوحة
          </Link>
          <a
            href="/api/admin/orders/export"
            download
            className="rounded-xl border border-green-600 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition whitespace-nowrap"
          >
            ⬇️ تصدير Excel
          </a>
        </div>
      </header>

      {/* Status Filter */}
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="تصفية حسب الحالة">
        <Link
          href={`/admin/orders?status=all`}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            statusFilter === "all"
              ? "bg-black text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          الكل ({totalOrders})
        </Link>
        {Object.entries(STATUS_AR).map(([key, label]) => {
          if (key === "all") return null;
          return (
            <Link
              key={key}
              href={`/admin/orders?status=${key}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                statusFilter === key
                  ? "bg-black text-white"
                  : STATUS_COLOR[key] + " hover:opacity-80"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Orders List */}
      <section>
        <OrdersList orders={recentOrders as any} products={allProducts} />

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" aria-label="تنقل الصفحات">
            <p className="text-sm text-gray-500">
              صفحة {page} من {totalPages} — إجمالي {totalOrders} طلب
            </p>
            <div className="flex items-center gap-1.5">
              {page > 1 && (
                <Link
                  href={`/admin/orders?page=${page - 1}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`}
                  className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50 transition"
                >
                  ← السابق
                </Link>
              )}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <Link
                      key={pageNum}
                      href={`/admin/orders?page=${pageNum}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition ${
                        pageNum === page
                          ? "bg-black text-white"
                          : "border text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {pageNum}
                    </Link>
                  );
                })}
              </div>
              {page < totalPages && (
                <Link
                  href={`/admin/orders?page=${page + 1}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`}
                  className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50 transition"
                >
                  التالي →
                </Link>
              )}
            </div>
          </nav>
        )}
      </section>
    </main>
  );
}