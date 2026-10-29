"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/schema";
import { deleteProduct, deleteOrder, setOrderStatus } from "@/lib/admin-actions";

interface ProductListProps {
  products: Product[];
  siteUrl: string;
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = new Date(date);
  return (
    d.toLocaleDateString("ar-DZ", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("ar-DZ", { hour: "2-digit", minute: "2-digit", hour12: false })
  );
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="rounded-full bg-red-50 text-red-700 px-2 py-0.5 text-xs font-medium">نفد المخزون</span>;
  if (stock < 10) return <span className="rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-medium">مخزون منخفض ({stock})</span>;
  return <span className="rounded-full bg-green-50 text-green-700 px-2 py-0.5 text-xs font-medium">متوفر ({stock})</span>;
}

export function ProductList({ products, siteUrl }: ProductListProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);
  const router = useRouter();

  const handleDeleteClick = (id: number, title: string) => {
    setDeleteConfirm({ id, title });
  };

  const handleConfirmDelete = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!deleteConfirm) return;
    const formData = new FormData(e.currentTarget);
    formData.set("id", String(deleteConfirm.id));
    setDeleteConfirm(null);
    await deleteProduct(formData);
    router.push("/admin");
    router.refresh();
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  if (products.length === 0) {
    return (
      <section>
        <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <div className="text-4xl mb-2">📦</div>
          <h3 className="font-bold text-gray-900">لا توجد منتجات بعد</h3>
          <p className="text-sm text-gray-500 mt-1">ابدأ بإنشاء أول Landing Page أو صفحة منتج</p>
          <Link
            href="/admin/products/new"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-white font-medium hover:bg-gray-900 transition"
          >
            <span>+</span> منتج جديد
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section>
        <div className="space-y-2">
          {products.map((p) => (
            <article
              key={p.id}
              className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-gray-100 bg-white p-3 hover:border-gray-200 hover:shadow-sm transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-bold text-gray-900">{p.active ? "🟢" : "⚪"} {p.title}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    {(p.pageType ?? "landing") === "product" ? "📄 منتج" : "🚀 هبوط"}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    {(p.pricingMode ?? "qty") === "offers" ? "🎁 عروض" : "📦 كمية"}
                  </span>
                  <StockBadge stock={p.stock ?? 100} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{p.price.toLocaleString("ar-DZ")} دج</span>
                  <span dir="ltr" className="font-mono">
                    <Link href={`/${p.slug}`} className="text-blue-600 hover:underline">/{p.slug}</Link>
                  </span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">تم التحديث: {formatDate(p.updatedAt)}</span>
                </div>
              </div>
              <div className="flex shrink-0 gap-2 sm:ml-4">
                <Link
                  href={`/admin/products/${p.id}`}
                  className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 transition whitespace-nowrap"
                >
                  تعديل
                </Link>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(p.id, p.title)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 transition whitespace-nowrap"
                >
                  حذف
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleCancelDelete}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 rounded-full bg-red-100 p-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-extrabold text-gray-900">تأكيد الحذف</h3>
            </div>
            <p className="mb-6 text-gray-600">
              هل أنت متأكد من حذف المنتج <strong className="text-gray-900">"{deleteConfirm.title}"</strong>؟
              <br />
              <span className="text-sm text-red-600">هذا الإجراء لا يمكن التراجع عنه.</span>
            </p>
            <form onSubmit={handleConfirmDelete} className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="flex-1 rounded-xl border px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-700 transition"
              >
                نعم، احذف المنتج
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const STATUS_AR: Record<string, string> = {
  draft: "📝 مسودة",
  new: "🆕 جديد",
  confirmed: "✅ مؤكد",
  shipped: "🚚 تم الشحن",
  delivered: "📦 تم التوصيل",
  cancelled: "❌ ملغي",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  new: "bg-blue-50 text-blue-700",
  confirmed: "bg-green-50 text-green-700",
  shipped: "bg-amber-50 text-amber-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

interface Order {
  id: number;
  productTitle: string;
  qty: number;
  total: number;
  shipping?: number | null;
  delivery?: string | null;
  status?: string | null;
  fullName: string;
  phone: string;
  wilayaName: string;
  wilayaCode: string;
  commune: string;
  address?: string | null;
  createdAt?: Date | string | null;
}

interface OrdersListProps {
  orders: Order[];
  products?: Product[];
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = status ?? "new";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[key] ?? STATUS_COLOR.new}`}>
      {STATUS_AR[key] ?? key}
    </span>
  );
}

function DeliveryBadge({ delivery }: { delivery: string | null | undefined }) {
  const isStopdesk = delivery === "stopdesk";
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600">
      {isStopdesk ? "🏢 مكتب" : "🏠 منزل"}
    </span>
  );
}

export function OrdersList({ orders, products = [] }: OrdersListProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");

  const handleDeleteClick = (id: number, title: string) => {
    setDeleteConfirm({ id, title });
  };

  const handleConfirmDelete = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!deleteConfirm) return;
    const formData = new FormData(e.currentTarget);
    formData.set("id", String(deleteConfirm.id));
    setDeleteConfirm(null);
    await deleteOrder(formData);
    router.push("/admin");
    router.refresh();
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  // Filter by status first, then by product
  const statusFiltered = statusFilter === "all"
    ? orders
    : orders.filter((o) => (o.status ?? "new") === statusFilter);

  const filteredOrders = productFilter === "all"
    ? statusFiltered
    : statusFiltered.filter((o) => o.productTitle === productFilter);

  const statusCounts = orders.reduce((acc, o) => {
    const key = o.status ?? "new";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const productCounts = orders.reduce((acc, o) => {
    acc[o.productTitle] = (acc[o.productTitle] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (orders.length === 0) {
    return (
      <section>
        <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <div className="text-4xl mb-2">📋</div>
          <h3 className="font-bold text-gray-900">لا توجد طلبات بعد</h3>
          <p className="text-sm text-gray-500 mt-1">ستظهر الطلبات هنا بمجرد استلامها</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          <h2 className="text-lg font-extrabold">أحدث الطلبات <span className="font-normal text-gray-500">({filteredOrders.length}/{orders.length})</span></h2>
          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="تصفية حسب الحالة">
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${statusFilter === "all" ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            >
              الكل ({orders.length})
            </button>
            {Object.entries(STATUS_AR).map(([key, label]) => {
              const shortLabel = label.replace(/^./, "").trim();
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    statusFilter === key ? "bg-black text-white" : STATUS_COLOR[key] + " hover:opacity-80"
                  }`}
                >
                  {shortLabel} ({statusCounts[key] ?? 0})
                </button>
              );
            })}
          </div>
          {/* Product filter pills */}
          {products.length > 0 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="تصفية حسب المنتج">
              <button
                onClick={() => setProductFilter("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${productFilter === "all" ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                جميع المنتجات
              </button>
              {products.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProductFilter(p.title)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${productFilter === p.title ? "bg-black text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  {p.title} ({productCounts[p.title] ?? 0})
                </button>
              ))}
            </div>
          )}
        </div>
        <a
          href="/api/admin/orders/export"
          download
          className="rounded-xl border border-green-600 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition whitespace-nowrap"
        >
          ⬇️ تصدير Excel
        </a>
      </div>

      {/* Orders List */}
      <div className="space-y-2">
        {filteredOrders.map((o) => (
          <article
            key={o.id}
            className="rounded-xl border border-gray-100 bg-white p-3 hover:border-gray-200 hover:shadow-sm transition"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">
                  #{o.id} — {o.productTitle} × {o.qty} = <span className="text-green-700">{o.total.toLocaleString("ar-DZ")} دج</span>
                </p>
                {(o.shipping ?? 0) > 0 && (
                  <p className="text-[12px] text-gray-500 mt-0.5">شامل التوصيل {o.shipping?.toLocaleString("ar-DZ")} دج</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <DeliveryBadge delivery={o.delivery} />
                <StatusBadge status={o.status} />
              </div>
            </div>

            <div className="grid gap-1.5 sm:grid-cols-2 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">👤</span>
                <span className="font-medium text-gray-900">{o.fullName}</span>
                <span className="text-gray-400">—</span>
                <span dir="ltr" className="font-mono">{o.phone}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">📍</span>
                <span>{o.wilayaName} ({o.wilayaCode}) — {o.commune}</span>
              </div>
              {o.address && (
                <div className="sm:col-span-2 flex items-center gap-1.5 text-[12px]">
                  <span className="text-gray-400">📌</span>
                  <span className="truncate">{o.address}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
                <span>🕐</span>
                <span dir="ltr" className="font-mono">{formatDate(o.createdAt)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2">
              <form action={setOrderStatus} className="flex gap-1.5 flex-1 min-w-[200px]">
                <input type="hidden" name="id" value={o.id} />
                <select
                  name="status"
                  defaultValue={o.status || "new"}
                  className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-black focus:outline-none"
                  aria-label="تغيير حالة الطلب"
                >
                  {Object.entries(STATUS_AR).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <button className="rounded-lg bg-black px-3 py-1.5 font-medium text-white text-sm hover:bg-gray-900 transition whitespace-nowrap">
                  حفظ
                </button>
              </form>
              <button
                type="button"
                onClick={() => handleDeleteClick(o.id, `#${o.id} — ${o.productTitle}`)}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 transition whitespace-nowrap"
              >
                حذف
              </button>
            </div>
          </article>
        ))}
        {filteredOrders.length === 0 && orders.length > 0 && (
          <p className="rounded-xl bg-gray-50 p-4 text-center text-gray-500">لا توجد طلبات بهذه الحالة.</p>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleCancelDelete}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 rounded-full bg-red-100 p-3">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-extrabold text-gray-900">تأكيد الحذف</h3>
            </div>
            <p className="mb-6 text-gray-600">
              هل أنت متأكد من حذف الطلب <strong className="text-gray-900">"{deleteConfirm.title}"</strong>؟
              <br />
              <span className="text-sm text-red-600">هذا الإجراء لا يمكن التراجع عنه.</span>
            </p>
            <form onSubmit={handleConfirmDelete} className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="flex-1 rounded-xl border px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-700 transition"
              >
                نعم، احذف الطلب
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}