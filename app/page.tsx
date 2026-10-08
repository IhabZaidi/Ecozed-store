import Link from "next/link";

// No public storefront by design — visitors only ever see /[slug] landing pages.
// This root page is a lightweight placeholder (also good for health checks).
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-extrabold">Ecozed Store</h1>
      <p className="text-gray-600">
        هذه الصفحة غير مخصصة للزوار. اطلب عبر رابط المنتج الذي وصلك.
      </p>
      <Link
        href="/admin"
        className="rounded-lg bg-black px-5 py-2.5 text-white"
      >
        دخول الإدارة
      </Link>
    </main>
  );
}
