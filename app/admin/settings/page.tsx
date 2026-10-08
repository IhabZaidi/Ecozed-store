import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { getRawSettings, getShipping } from "@/lib/settings";
import { SettingsTabs } from "./SettingsTabs";

export default async function AdminSettings({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; tgtest?: string; tab?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { saved, tgtest, tab } = await searchParams;
  const s = await getRawSettings([
    "fb_pixel_id",
    "fb_capi_token",
    "fb_test_code",
    "tg_bot_token",
    "tg_chat_id",
    "gs_spreadsheet_id",
    "gs_client_email",
    "gs_private_key",
    "gs_tab",
  ]);
  const ship = await getShipping();

  return (
    <main className="mx-auto max-w-2xl p-4 pb-16">
      <p className="py-4">
        <Link href="/admin" className="font-bold text-blue-600 underline">
          → رجوع للوحة الإدارة
        </Link>
      </p>
      <h1 className="text-2xl font-black">⚙️ الإعدادات</h1>
      <SettingsTabs
        initialTab={tab ?? "pixel"}
        saved={saved === "1"}
        tgtest={tgtest ?? ""}
        s={s}
        ship={ship}
      />
    </main>
  );
}
