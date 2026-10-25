"use client";

import Link from "next/link";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/schema";
import { deleteProduct } from "@/lib/admin-actions";
import { setOrderStatus, deleteOrder } from "@/lib/admin-actions";

interface ProductListProps {
  products: Product[];
  siteUrl: string;
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
    // Close modal immediately (optimistic)
    setDeleteConfirm(null);
    // Fire server action, then navigate client-side
    await deleteProduct(formData);
    router.push("/admin");
    router.refresh();
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  return (
    <>
      <section>
        <h2 className="mb-2 text-lg font-extrabold">المنتجات ({products.length})</h2>
        <div className="space-y-2">
          {products.map((p) => (
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
                <button
                  type="button"
                  onClick={() => handleDeleteClick(p.id, p.title)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-bold text-red-600"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <p className="rounded-xl bg-gray-50 p-4 text-gray-500">
              لا توجد منتجات بعد. أنشئ أول Landing Page من زر "منتج جديد".
            </p>
          )}
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
                className="flex-1 rounded-xl border px-4 py-3 font-bold text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700"
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
}

interface OrdersListProps {
  orders: Order[];
}

export function OrdersList({ orders }: OrdersListProps) {
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
    // Close modal immediately (optimistic)
    setDeleteConfirm(null);
    // Fire server action, then navigate client-side
    await deleteOrder(formData);
    router.push("/admin");
    router.refresh();
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  return (
    <section>
      <h2 className="mb-2 text-lg font-extrabold">أحدث الطلبات ({orders.length})</h2>
      <div className="space-y-2">
        {orders.map((o) => (
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
            <div className="mt-2 flex items-center gap-2">
              <form action={setOrderStatus} className="flex gap-2">
                <input type="hidden" name="id" value={o.id} />
                <select name="status" defaultValue={o.status || "new"} className="rounded-lg border px-2 py-1">
                  {Object.entries(STATUS_AR).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <button className="rounded-lg bg-black px-3 py-1 font-bold text-white">حفظ</button>
              </form>
              <button
                type="button"
                onClick={() => handleDeleteClick(o.id, `#${o.id} — ${o.productTitle}`)}
                className="rounded-lg border border-red-300 px-3 py-1 font-bold text-red-600"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <p className="rounded-xl bg-gray-50 p-4 text-gray-500">لا توجد طلبات بعد.</p>
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
                className="flex-1 rounded-xl border px-4 py-3 font-bold text-gray-700 hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700"
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