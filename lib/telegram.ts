import { getRawSettings } from "./settings";
import { withRetries } from "./retry";

function esc(s: string) {
  // Telegram parse_mode=HTML fails the WHOLE message on raw & < >
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Bot token + chat ID: DB settings first, env fallback. */
export async function getTelegramConfig() {
  const s = await getRawSettings(["tg_bot_token", "tg_chat_id"]);
  return {
    token: s["tg_bot_token"] || process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: s["tg_chat_id"] || process.env.TELEGRAM_CHAT_ID || "",
  };
}

export async function sendTelegram(text: string) {
  // Same local kill-switch as CAPI (see lib/fb.ts).
  if (process.env.DISABLE_OUTBOUND === "1") return { skipped: true };
  const { token, chatId } = await getTelegramConfig();
  if (!token || !chatId) {
    // Same rule as CAPI: a missing bot/chat in production must scream,
    // not silently skip every notification while orders pile up.
    console.error("[telegram] bot token or chat ID missing — message skipped");
    return { skipped: true };
  }
  try {
    // Retry network throws only (see lib/retry.ts): an HTTP error from
    // Telegram is decisive and resending could double-post the message.
    const res = await withRetries("Telegram send", 3, () =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      })
    );
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("Telegram API error", res.status, err.slice(0, 200));
    }
    return { ok: res.ok, status: res.status };
  } catch (e) {
    console.error("Telegram failed", e);
    return { ok: false };
  }
}

export function orderTelegramText(o: {
  id: number;
  productTitle: string;
  qty: number;
  unitPrice?: number;
  total: number;
  fullName: string;
  phone: string;
  wilayaCode?: string;
  wilayaName: string;
  commune: string;
  address?: string;
  shipping?: number;
  deliveryLabel?: string;
}) {
  // Plain numbers, no thousands separator (e.g. 3300 not 3.300)
  const lines = [
    `🚨 <b>طلب جديد #${o.id}</b>`,
    `👤 الاسم: ${esc(o.fullName)}`,
    `📞 الهاتف: <code>${esc(o.phone)}</code>`,
    `📍 العنوان: DZ-${esc(o.wilayaCode || "")} ${esc(o.wilayaName)} — ${esc(o.commune)}` +
      (o.address ? ` — ${esc(o.address)}` : ""),
    `🛒 المنتج: ${esc(o.productTitle)} × ${o.qty}` +
      (o.unitPrice ? ` (${o.unitPrice} دج/قطعة)` : ""),
    `🚚 التوصيل: ${esc(o.deliveryLabel || "المنزل")}` +
      (o.shipping ? ` — ${o.shipping} دج` : " — مجاني"),
    `💰 المجموع: <b>${o.total} دج</b>`,
  ];
  return lines.join("\n");
}
