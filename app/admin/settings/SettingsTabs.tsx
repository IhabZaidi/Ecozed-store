"use client";

import { useState } from "react";
import { WILAYAS } from "@/lib/wilayas";
import type { ShippingTable } from "@/lib/settings";
import { savePixelSettings, saveTelegramSettings, saveShippingSettings, saveSheetsSettings, testTelegram } from "@/lib/admin-actions";

type TabId = "pixel" | "telegram" | "shipping" | "sheets";

const TABS: { id: TabId; label: string }[] = [
  { id: "pixel", label: "📊 بكسل فيسبوك" },
  { id: "telegram", label: "📲 تلغرام" },
  { id: "shipping", label: "🚚 التوصيل" },
  { id: "sheets", label: "📗 جوجل شيت" },
];

export function SettingsTabs({
  initialTab,
  saved,
  tgtest,
  imported,
  importFail,
  s,
  ship,
}: {
  initialTab: string;
  saved: boolean;
  tgtest: string;
  imported: string;
  importFail: boolean;
  s: Record<string, string>;
  ship: ShippingTable;
}) {
  const [tab, setTab] = useState<TabId>(
    initialTab === "telegram" || initialTab === "shipping" || initialTab === "sheets"
      ? initialTab
      : "pixel"
  );

  return (
    <div>
      {saved && (
        <p className="mt-4 rounded-xl bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
          تم الحفظ ✅ — يُطبَّق خلال دقيقة على الأكثر
        </p>
      )}
      {tgtest === "ok" && (
        <p className="mt-4 rounded-xl bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
          وصلت رسالة التجربة ✅ تحقق من تلغرام
        </p>
      )}
      {tgtest === "fail" && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700">
          فشل الإرسال ❌ تحقق من التوكن والـ Chat ID ثم احفظ وحاول مجددًا
        </p>
      )}
      {imported && (
        <p className="mt-4 rounded-xl bg-green-50 px-4 py-2 text-sm font-bold text-green-700">
          تم استيراد أسعار {imported} ولاية ✅
        </p>
      )}
      {importFail && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700">
          ملف غير صالح ❌ استعمل ملف النسخة المصدرة من هنا
        </p>
      )}

      <div className="mt-4 flex gap-2" role="tablist" aria-label="أقسام الإعدادات">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            onClick={() => setTab(t.id)}
            aria-selected={tab === t.id}
            className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-extrabold transition ${
              tab === t.id
                ? "bg-black text-white"
                : "border border-gray-300 bg-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pixel" && (
        <div className="mt-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm">
            <p className="font-extrabold">📊 الأحداث التي نجمعها عبر البكسل:</p>
            <ul className="mt-2 space-y-1.5 text-gray-700">
              <li>
                <b>PageView</b> (المتصفح) — كل زيارة لصفحة منتج، من كود
                فيسبوك الرسمي.
              </li>
              <li>
                <b>ViewContent</b> (السيرفر) — مشاهدة منتج: الاسم + السعر +
                العملة (دج).
              </li>
              <li>
                <b>InitiateCheckout</b> (السيرفر) — عند تأكيد حفظ طلب مكتمل
                البيانات فقط.
              </li>
              <li>
                <b>Purchase</b> (السيرفر) — طلب جديد ناجح مع القيمة الإجمالية.
              </li>
            </ul>
            <p className="mt-2 text-xs text-gray-500">
              أحداث السيرفر تُرسل عبر Conversions API مع رقم الهاتف (مشفّر)
              وملفات تعريف فيسبوك للمطابقة — والمتصفح لا يرسل سوى PageView،
              فلا تكرار ولا فقدان مع مانعات الإعلانات.
            </p>
          </div>

          <form action={savePixelSettings} className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Pixel ID *</span>
              <input
                name="fb_pixel_id"
                dir="ltr"
                inputMode="numeric"
                defaultValue={s["fb_pixel_id"]}
                placeholder="1234567890"
                className="w-full rounded-xl border px-4 py-3 font-mono"
              />
              <span className="mt-1 block text-xs text-gray-500">
                تجده في Events Manager ← Data Sources ← رقم الـ Dataset
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-bold">
                Conversions API Access Token *
              </span>
              <input
                type="password"
                name="fb_capi_token"
                dir="ltr"
                defaultValue={s["fb_capi_token"]}
                placeholder="EAA…"
                autoComplete="off"
                className="w-full rounded-xl border px-4 py-3 font-mono text-sm"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Events Manager ← نفس الـ Dataset ← Settings ← Generate Access
                Token
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-bold">
                Test Event Code (للتجربة فقط)
              </span>
              <input
                name="fb_test_code"
                dir="ltr"
                defaultValue={s["fb_test_code"]}
                placeholder="TEST12345"
                autoComplete="off"
                className="w-full rounded-xl border px-4 py-3 font-mono"
              />
              <span className="mt-1 block text-xs text-gray-500">
                من Test Events في Events Manager — اتركه فارغًا في الإنتاج
              </span>
            </label>

            <button className="w-full rounded-2xl bg-black px-6 py-4 font-extrabold text-white">
              حفظ الإعدادات 💾
            </button>
          </form>
        </div>
      )}

      {tab === "telegram" && (
        <div className="mt-4">
          <p className="text-sm text-gray-500">
            كل طلب جديد يرسل رسالة فورية إلى بوتك. أنشئ البوت من BotFather ثم
            الصق التوكن هنا.
          </p>

          <form action={saveTelegramSettings} className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">Bot Token *</span>
              <input
                type="password"
                name="tg_bot_token"
                dir="ltr"
                defaultValue={s["tg_bot_token"]}
                placeholder="123456:ABC-DEF…"
                autoComplete="off"
                className="w-full rounded-xl border px-4 py-3 font-mono text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-bold">Chat ID *</span>
              <input
                name="tg_chat_id"
                dir="ltr"
                inputMode="numeric"
                defaultValue={s["tg_chat_id"]}
                placeholder="123456789"
                autoComplete="off"
                className="w-full rounded-xl border px-4 py-3 font-mono"
              />
              <span className="mt-1 block text-xs text-gray-500">
                أرسل أي رسالة للبوت ثم احصل على رقمك من @userinfobot
              </span>
            </label>

            <button className="w-full rounded-2xl bg-black px-6 py-4 font-extrabold text-white">
              حفظ الإعدادات 💾
            </button>
          </form>
          <form action={testTelegram} className="mt-2">
            <button className="w-full rounded-2xl border-2 border-green-600 px-6 py-3 font-extrabold text-green-700">
              ✉️ إرسال رسالة تجربة
            </button>
          </form>
        </div>
      )}

      {tab === "shipping" && (
        <div className="mt-4">
          <p className="text-sm text-gray-500">
            الزبون يرى المجموع = السعر + التوصيل حسب ولايته وطريقة الاستلام.
          </p>

          <form action={saveShippingSettings} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-bold">
                  اسم شركة التوصيل (يظهر بجانب المكتب)
                </span>
                <input
                  name="shipping_company"
                  dir="ltr"
                  defaultValue={ship.company}
                  placeholder="Yalidine"
                  className="w-full rounded-xl border px-4 py-3 font-mono"
                />
              </label>
              <div className="rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-500">
                💡 الولاية الفارغة = توصيل مجاني (0 دج). خيار المكتب يظهر
                للزبون فقط إذا كان هناك سعر توصيل للمكتب أكبر من 0.
              </div>
            </div>

            <div className="space-y-2">
              {WILAYAS.map((w) => (
                <div
                  key={w.code}
                  className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                >
                  <span className="min-w-28 flex-1 font-bold">
                    {w.code} — {w.ar}
                  </span>
                  <label className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">🏠</span>
                    <input
                      name={`home_${w.code}`}
                      type="number"
                      min={0}
                      dir="ltr"
                      defaultValue={ship.home[w.code] ?? ""}
                      placeholder={String(ship.homeDef || 0)}
                      className="w-20 rounded-lg border px-2 py-1 font-mono"
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">🏢</span>
                    <input
                      name={`stop_${w.code}`}
                      type="number"
                      min={0}
                      dir="ltr"
                      defaultValue={ship.stop[w.code] ?? ""}
                      placeholder={String(ship.stopDef || 0)}
                      className="w-20 rounded-lg border px-2 py-1 font-mono"
                    />
                  </label>
                </div>
              ))}
            </div>

          <button className="w-full rounded-2xl bg-black px-6 py-4 font-extrabold text-white">
            حفظ الإعدادات 💾
          </button>
        </form>

        {/* Backup / restore: portable JSON, no retyping on a new server */}
        <div className="mt-4 flex gap-2">
          <a
            href="/api/admin/shipping/export"
            download
            className="flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-extrabold"
          >
            ⬇️ تصدير نسخة
          </a>
          <form
            action="/api/admin/shipping/import"
            method="post"
            encType="multipart/form-data"
            className="flex flex-1 items-center gap-2 rounded-2xl border px-3 py-2"
          >
            <input
              type="file"
              name="file"
              accept="application/json,.json"
              required
              className="w-full text-xs"
            />
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-black px-3 py-2 text-xs font-extrabold text-white"
            >
              ⬆️ استيراد
            </button>
          </form>
        </div>
      </div>
      )}

      {tab === "sheets" && (
        <div className="mt-4">
          <p className="text-sm text-gray-500">
            كل طلب جديد يُضاف كصف في الجدول. شارك الجدول مع بريد حساب الخدمة
            أولًا (Editor).
          </p>

          <form action={saveSheetsSettings} className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-bold">
                Spreadsheet ID *
              </span>
              <input
                name="gs_spreadsheet_id"
                dir="ltr"
                defaultValue={s["gs_spreadsheet_id"]}
                placeholder="1BxiMVs0XRA5n…"
                autoComplete="off"
                className="w-full rounded-xl border px-4 py-3 font-mono text-sm"
              />
              <span className="mt-1 block text-xs text-gray-500">
                من رابط الجدول بين /d/ و /edit
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-bold">
                Service Account Email *
              </span>
              <input
                name="gs_client_email"
                dir="ltr"
                defaultValue={s["gs_client_email"]}
                placeholder="…@….iam.gserviceaccount.com"
                autoComplete="off"
                className="w-full rounded-xl border px-4 py-3 font-mono text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-bold">
                Private Key *
              </span>
              <textarea
                name="gs_private_key"
                dir="ltr"
                rows={4}
                defaultValue={s["gs_private_key"]}
                placeholder="-----BEGIN PRIVATE KEY-----…"
                autoComplete="off"
                className="w-full rounded-xl border px-4 py-3 font-mono text-xs"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-bold">اسم الورقة</span>
              <input
                name="gs_tab"
                dir="ltr"
                defaultValue={s["gs_tab"] || "Orders"}
                placeholder="Orders"
                className="w-full rounded-xl border px-4 py-3 font-mono"
              />
            </label>

            <button className="w-full rounded-2xl bg-black px-6 py-4 font-extrabold text-white">
              حفظ الإعدادات 💾
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
