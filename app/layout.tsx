import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL) || "http://localhost:3005"
  ),
  title: "Ecozed Store",
  description: "اطلب الآن — الدفع عند الاستلام",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // RTL + Arabic by default. No Google Fonts = fastest first paint.
  // (Stays a static layout on purpose: pixel preconnect lives in the
  // landing pages themselves so static routes keep prerendering.)
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}

