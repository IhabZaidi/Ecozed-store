import { redirect } from "next/navigation";
import Link from "next/link";
import { desc, count, sql } from "drizzle-orm";
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

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  new: "bg-blue-50 text-blue-700",
  confirmed: "bg-green-50 text-green-700",
  shipped: "bg-amber-50 text-amber-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

export default async function AdminHome() {
  if (!(await isAdmin())) redirect("/admin/login");
  const siteUrl = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL) || "";

  // Fetch data in parallel
  const [allProducts, recentOrders, stats] = await Promise.all([
    db.select().from(products).orderBy(desc(products.id)).limit(100),
    db.select().from(orders).orderBy(desc(orders.id)).limit(50),
    getDashboardStats(),
  ]);

  // Compute alerts
  const lowStockProducts = allProducts.filter((p) => (p.stock ?? 100) > 0 && (p.stock ?? 100) < 10);
  const outOfStockProducts = allProducts.filter((p) => (p.stock ?? 100) <= 0);
  const pendingOrders = recentOrders.filter((o) => (o.status ?? "new") === "new");
  const inactiveProducts = allProducts.filter((p) => !p.active);

  return (
    <main className="mx-auto max-w-6xl p-4 pb-16">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b">
        <div>
          <h1 className="text-2xl font-black tracking-tight">لوحة الإدارة</h1>
          <p className="text-sm text-gray-500 mt-0.5">إدارة المنتجات والطلبات والإعدادات</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/settings" className="rounded-xl border px-4 py-2 font-medium text-sm hover:bg-gray-50 transition">
            ⚙️ الإعدادات
          </Link>
          <Link href="/admin/products/new" className="rounded-xl bg-black px-4 py-2 font-medium text-white text-sm hover:bg-gray-900 transition">
            + منتج جديد
          </Link>
          <LogoutBtn />
        </div>
      </header>

      {/* Alerts */}
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0 || pendingOrders.length > 0) && (
        <AlertsBar
          lowStock={lowStockProducts.length}
          outOfStock={outOfStockProducts.length}
          pending={pendingOrders.length}
          inactive={inactiveProducts.length}
        />
      )}

      {/* Stats Cards */}
      <StatsCards stats={stats} />

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3 mt-6">
        {/* Products Section - 2/3 width */}
        <section className="lg:col-span-2">
          <SectionHeader
            title="المنتجات"
            count={allProducts.length}
            action={<Link href="/admin/products/new" className="text-sm font-medium text-black hover:underline">+ إضافة</Link>}
          />
          <ProductList products={allProducts} siteUrl={siteUrl} />
        </section>

        {/* Orders Section - 1/3 width */}
        <section className="lg:col-span-1">
          <SectionHeader
            title="أحدث الطلبات"
            count={recentOrders.length}
            action={
              <a
                href="/api/admin/orders/export"
                download
                className="text-sm font-medium text-green-700 hover:underline"
              >
                ⬇️ تصدير
              </a>
            }
          />
          <OrdersList orders={recentOrders as any} products={allProducts} />
        </section>
      </div>
    </main>
  );
}

async function getDashboardStats() {
  const [productStats, orderStats] = await Promise.all([
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${products.active} = true)`,
        landing: sql<number>`count(*) filter (where ${products.pageType} = 'landing')`,
        product: sql<number>`count(*) filter (where ${products.pageType} = 'product')`,
      })
      .from(products),
    db
      .select({
        total: count(),
        today: sql<number>`count(*) filter (where date(${orders.createdAt}) = date(now()))`,
        revenue: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} not in ('cancelled', 'draft')), 0)`,
        pending: sql<number>`count(*) filter (where ${orders.status} = 'new')`,
      })
      .from(orders),
  ]);

  return {
    products: productStats[0],
    orders: orderStats[0],
  };
}

interface Stats {
  products: {
    total: number;
    active: number;
    landing: number;
    product: number;
  };
  orders: {
    total: number;
    today: number;
    revenue: number;
    pending: number;
  };
}

function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    {
      label: "إجمالي المنتجات",
      value: stats.products.total,
      subtitle: `${stats.products.active} نشط • ${stats.products.landing} هبوط • ${stats.products.product} منتج`,
      icon: "📦",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "إجمالي الطلبات",
      value: stats.orders.total,
      subtitle: `${stats.orders.today} اليوم • ${stats.orders.pending} قيد الانتظار`,
      icon: "📋",
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "الإيرادات (دج)",
      value: stats.orders.revenue.toLocaleString("ar-DZ"),
      subtitle: "باستثناء الملغاة والمسودات",
      icon: "💰",
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3 mb-6" role="region" aria-label="إحصائيات سريعة">
      {cards.map((card, i) => (
        <article
          key={i}
          className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
              <p className="mt-1 text-3xl font-black tracking-tight">{card.value}</p>
              <p className="mt-1 text-xs text-gray-400">{card.subtitle}</p>
            </div>
            <span className={`${card.bg} ${card.color} rounded-xl p-3 text-2xl`}>{card.icon}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function AlertsBar({
  lowStock,
  outOfStock,
  pending,
  inactive,
}: {
  lowStock: number;
  outOfStock: number;
  pending: number;
  inactive: number;
}) {
  const alerts = [
    outOfStock > 0 && {
      count: outOfStock,
      label: "منتج نفد مخزونه",
      color: "bg-red-50 text-red-700 border-red-200",
      icon: "⚠️",
      href: "/admin",
    },
    lowStock > 0 && {
      count: lowStock,
      label: "منتجات مخزون منخفض (<10)",
      color: "bg-amber-50 text-amber-700 border-amber-200",
      icon: "📉",
      href: "/admin",
    },
    pending > 0 && {
      count: pending,
      label: "طلبات قيد الانتظار",
      color: "bg-blue-50 text-blue-700 border-blue-200",
      icon: "🔔",
      href: "/admin",
    },
    inactive > 0 && {
      count: inactive,
      label: "منتجات غير منشورة",
      color: "bg-gray-50 text-gray-700 border-gray-200",
      icon: "⏸️",
      href: "/admin",
    },
  ].filter(Boolean) as Array<{
    count: number;
    label: string;
    color: string;
    icon: string;
    href: string;
  }>;

  if (alerts.length === 0) return null;

  return (
    <div className="mb-6" role="region" aria-label="تنبيهات">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {alerts.map((alert, i) => (
          <Link
            key={i}
            href={alert.href}
            className={`rounded-xl border p-3 flex items-center gap-3 ${alert.color} hover:shadow-md transition-shadow`}
          >
            <span className="text-xl">{alert.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">{alert.count}</p>
              <p className="text-xs truncate">{alert.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { label: "منتج جديد", href: "/admin/products/new", icon: "➕", color: "bg-black text-white" },
    { label: "الطلبات", href: "/admin/orders", icon: "📋", color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
    { label: "الإعدادات", href: "/admin/settings", icon: "⚙️", color: "bg-gray-50 text-gray-700 hover:bg-gray-100" },
    { label: "تصدير الطلبات", href: "/api/admin/orders/export", icon: "⬇️", color: "bg-green-50 text-green-700 hover:bg-green-100" },
  ];

  return (
    <div className="mb-6" role="region" aria-label="إجراءات سريعة">
      <h3 className="text-sm font-bold text-gray-900 mb-3">إجراءات سريعة</h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((action, i) => (
          <Link
            key={i}
            href={action.href}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${action.color} transition`}
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
      <div>
        <h2 className="text-lg font-extrabold flex items-center gap-2">
          {title}
          <span className="text-sm font-normal text-gray-500">({count})</span>
        </h2>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
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
      <button className="rounded-xl border px-4 py-2 font-medium text-sm hover:bg-gray-50 transition">
        خروج
      </button>
    </form>
  );
}