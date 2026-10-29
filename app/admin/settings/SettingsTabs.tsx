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
      {/* Toast notifications */}
      <div className="space-y-2" role="status" aria-live="polite">
        {saved && (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700 flex items-center gap-2">
            <span className="flex-shrink-0">✅</span>
            <span>تم الحفظ — يُطبَّق خلال دقيقة على الأكثر</span>
          </div>
        )}
        {tgtest === "ok" && (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700 flex items-center gap-2">
            <span className="flex-shrink-0">✅</span>
            <span>وصلت رسالة التجربة — تحقق من تلغرام</span>
          </div>
        )}
        {tgtest === "fail" && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 flex items-center gap-2">
            <span className="flex-shrink-0">❌</span>
            <span>فشل الإرسال — تحقق من التوكن والـ Chat ID ثم احفظ وحاول مجددًا</span>
          </div>
        )}
        {imported && (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700 flex items-center gap-2">
            <span className="flex-shrink-0">✅</span>
            <span>تم استيراد أسعار {imported} ولاية</span>
          </div>
        )}
        {importFail && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 flex items-center gap-2">
            <span className="flex-shrink-0">❌</span>
            <span>ملف غير صالح — استعمل ملف النسخة المصدرة من هنا</span>
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div className="mt-4 flex gap-1.5 bg-gray-100 p-1.5 rounded-xl" role="tablist" aria-label="أقسام الإعدادات">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            onClick={() => setTab(t.id)}
            aria-selected={tab === t.id}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-white text-black shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pixel" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm">
            <p className="font-extrabold text-gray-900">📊 الأحداث التي نجمعها عبر البكسل:</p>
            <ul className="mt-2 space-y-1.5 text-gray-700">
              <li>
                <b>PageView</b> (المتصفح + السيرفر بنفس المعرف) — كل زيارة
                لصفحة منتج، تُحتسب مرة واحدة بفضل المطابقة (deduplication).
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

          <form action={savePixelSettings} className="space-y-4">
            {/* Required fields */}
            <fieldset className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
              <legend className="text-sm font-bold text-gray-900">الإعدادات المطلوبة</legend>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Pixel ID *</span>
                <input
                  name="fb_pixel_id"
                  dir="ltr"
                  inputMode="numeric"
                  defaultValue={s["fb_pixel_id"]}
                  placeholder="1234567890"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-black focus:outline-none"
                />
                <span className="text-xs text-gray-500">
                  تجده في Events Manager ← Data Sources ← رقم الـ Dataset
                </span>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">
                  Conversions API Access Token *
                </span>
                <input
                  type="password"
                  name="fb_capi_token"
                  dir="ltr"
                  defaultValue={s["fb_capi_token"]}
                  placeholder="EAA…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm focus:border-black focus:outline-none"
                />
                <span className="text-xs text-gray-500">
                  Events Manager ← نفس الـ Dataset ← Settings ← Generate Access
                  Token
                </span>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">
                  Test Event Code (للتجربة فقط)
                </span>
                <input
                  name="fb_test_code"
                  dir="ltr"
                  defaultValue={s["fb_test_code"]}
                  placeholder="TEST12345"
                  autoComplete="off"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-black focus:outline-none"
                />
                <span className="text-xs text-gray-500">
                  من Test Events في Events Manager — اتركه فارغًا في الإنتاج
                </span>
              </label>
            </fieldset>

            {/* Optional Clarity */}
            <fieldset className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-1.5">
              <legend className="text-sm font-medium text-blue-800">🔍 Microsoft Clarity ID (اختياري)</legend>
              <label className="block space-y-1.5">
                <input
                  name="clarity_id"
                  dir="ltr"
                  defaultValue={s["clarity_id"]}
                  placeholder="مثال: t1v9x8y7z6"
                  autoComplete="off"
                  className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 font-mono focus:border-black focus:outline-none"
                />
                <span className="text-xs text-blue-700">
                  من clarity.microsoft.com ← مشروعك ← Setup. فارغ = لا يتحمّل
                  شيء (صفر تأثير على السرعة). يُحمَّل بعد LCP فقط.
                </span>
              </label>
            </fieldset>

            <button className="w-full rounded-2xl bg-black px-6 py-3.5 font-bold text-white hover:bg-gray-900 transition">
              حفظ الإعدادات 💾
            </button>
          </form>
        </div>
      )}

      {tab === "telegram" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-500">
            كل طلب جديد يرسل رسالة فورية إلى بوتك. أنشئ البوت من BotFather ثم
            الصق التوكن هنا.
          </p>

          <form action={saveTelegramSettings} className="space-y-4">
            <fieldset className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
              <legend className="text-sm font-bold text-gray-900">إعدادات البوت</legend>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Bot Token *</span>
                <input
                  type="password"
                  name="tg_bot_token"
                  dir="ltr"
                  defaultValue={s["tg_bot_token"]}
                  placeholder="123456:ABC-DEF…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm focus:border-black focus:outline-none"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">Chat ID *</span>
                <input
                  name="tg_chat_id"
                  dir="ltr"
                  inputMode="numeric"
                  defaultValue={s["tg_chat_id"]}
                  placeholder="123456789"
                  autoComplete="off"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-black focus:outline-none"
                />
                <span className="text-xs text-gray-500">
                  أرسل أي رسالة للبوت ثم احصل على رقمك من @userinfobot
                </span>
              </label>
            </fieldset>

            <button className="w-full rounded-2xl bg-black px-6 py-3.5 font-bold text-white hover:bg-gray-900 transition">
              حفظ الإعدادات 💾
            </button>
          </form>

          <form action={testTelegram} className="space-y-4">
            <button className="w-full rounded-2xl border-2 border-green-600 bg-green-50 px-6 py-3.5 font-bold text-green-700 hover:bg-green-100 transition">
              ✉️ إرسال رسالة تجربة
            </button>
          </form>
        </div>
      )}

      {tab === "shipping" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-500">
            الزبون يرى المجموع = السعر + التوصيل حسب ولايته وطريقة الاستلام.
          </p>

          <form action={saveShippingSettings} className="space-y-4">
            <fieldset className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4 sm:grid sm:grid-cols-2 sm:gap-4">
              <legend className="text-sm font-bold text-gray-900">إعدادات عامة</legend>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">
                  اسم شركة التوصيل (يظهر بجانب المكتب)
                </span>
                <input
                  name="shipping_company"
                  dir="ltr"
                  defaultValue={ship.company}
                  placeholder="Yalidine"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-black focus:outline-none"
                />
              </label>

              <div className="rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-500 self-center">
                💡 الولاية الفارغة = توصيل مجاني (0 دج). خيار المكتب يظهر
                للزبون فقط إذا كان هناك سعر توصيل للمكتب أكبر من 0.
              </div>
            </fieldset>

            <fieldset className="rounded-2xl border border-gray-200 bg-white p-4">
              <legend className="text-sm font-bold text-gray-900 mb-3">أسعار التوصيل حسب الولاية</legend>
              <div className="space-y-1.5">
                {WILAYAS.map((w) => (
                  <div
                    key={w.code}
                    className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50 transition"
                  >
                    <span className="min-w-28 flex-1 font-medium text-gray-700">
                      {w.code} — {w.ar}
                    </span>
                    <label className="flex items-center gap-1">
                      <span className="text-xs text-gray-400" title="توصيل للمنزل">🏠</span>
                      <input
                        name={`home_${w.code}`}
                        type="number"
                        min={0}
                        dir="ltr"
                        defaultValue={ship.home[w.code] ?? ""}
                        placeholder={String(ship.homeDef || 0)}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 font-mono text-center focus:border-black focus:outline-none"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-xs text-gray-400" title="استلام من المكتب">🏢</span>
                      <input
                        name={`stop_${w.code}`}
                        type="number"
                        min={0}
                        dir="ltr"
                        defaultValue={ship.stop[w.code] ?? ""}
                        placeholder={String(ship.stopDef || 0)}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 font-mono text-center focus:border-black focus:outline-none"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </fieldset>

            <button className="w-full rounded-2xl bg-black px-6 py-3.5 font-bold text-white hover:bg-gray-900 transition">
              حفظ الإعدادات 💾
            </button>
          </form>

          {/* Backup / restore: portable JSON, no retyping on a new server */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">نسخة احتياطية / استيراد</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href="/api/admin/shipping/export"
                download
                className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                ⬇️ تصدير نسخة JSON
              </a>
              <form
                action="/api/admin/shipping/import"
                method="post"
                encType="multipart/form-data"
                className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2"
              >
                <input
                  type="file"
                  name="file"
                  accept="application/json,.json"
                  required
                  className="w-full text-xs text-gray-600"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white hover:bg-gray-900 transition"
                >
                  ⬆️ استيراد
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {tab === "sheets" && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-gray-500">
            كل طلب جديد يُضاف كصف في الجدول. شارك الجدول مع بريد حساب الخدمة
            أولًا (Editor).
          </p>

          <form action={saveSheetsSettings} className="space-y-4">
            <fieldset className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
              <legend className="text-sm font-bold text-gray-900">إعدادات Google Sheets</legend>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">
                  Spreadsheet ID *
                </span>
                <input
                  name="gs_spreadsheet_id"
                  dir="ltr"
                  defaultValue={s["gs_spreadsheet_id"]}
                  placeholder="1BxiMVs0XRA5n…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm focus:border-black focus:outline-none"
                />
                <span className="text-xs text-gray-500">
                  من رابط الجدول بين /d/ و /edit
                </span>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">
                  Service Account Email *
                </span>
                <input
                  name="gs_client_email"
                  dir="ltr"
                  defaultValue={s["gs_client_email"]}
                  placeholder="…@….iam.gserviceaccount.com"
                  autoComplete="off"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm focus:border-black focus:outline-none"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">
                  Private Key *
                </span>
                <textarea
                  name="gs_private_key"
                  dir="ltr"
                  rows={4}
                  defaultValue={s["gs_private_key"]}
                  placeholder="-----BEGIN PRIVATE KEY-----…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-xs focus:border-black focus:outline-none"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-gray-700">اسم الورقة</span>
                <input
                  name="gs_tab"
                  dir="ltr"
                  defaultValue={s["gs_tab"] || "Orders"}
                  placeholder="Orders"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-black focus:outline-none"
                />
              </label>
            </fieldset>

            <button className="w-full rounded-2xl bg-black px-6 py-3.5 font-bold text-white hover:bg-gray-900 transition">
              حفظ الإعدادات 💾
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
