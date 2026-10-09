import { z } from "zod";

// Algerian mobile: 05 / 06 / 07 + 8 digits. Also accepts +213 / 00213 / 213
// international format (+213550123456 → 0550123456). Separators ignored.
export const dzPhoneRegex = /^(05|06|07)\d{8}$/;

export function normalizePhone(raw: string) {
  let d = raw.replace(/[\s.\-()]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  d = d.replace(/\D/g, "");
  if (d.startsWith("00213") && d.length === 14) d = d.slice(2); // 00213… → 213…
  if (d.startsWith("213") && d.length === 12) d = "0" + d.slice(3);
  return d;
}

export const orderSchema = z.object({
  slug: z.string().min(1, "المنتج غير معروف"),
  fullName: z
    .string()
    .trim()
    .min(3, "يرجى إدخال الاسم الكامل")
    .max(80),
  phone: z.string().transform(normalizePhone).pipe(
    z
      .string()
      .regex(dzPhoneRegex, "رقم الهاتف غير صحيح (مثال: 0550123456)")
  ),
  wilayaCode: z.string().min(1, "اختر الولاية"),
  commune: z.string().trim().min(2, "أدخل البلدية").max(80),
  address: z.string().trim().max(200).default(""),
  qty: z.coerce.number().int().min(1).max(50).default(1),
  delivery: z.enum(["home", "stopdesk"]).default("home"),
  notes: z.string().trim().max(300).default(""),
  fbp: z.string().max(200).optional().default(""),
  fbc: z.string().max(200).optional().default(""),
  // background draft created while typing (upgraded to a real order on submit)
  draftId: z.coerce.number().int().optional(),
  draftKey: z.string().max(64).optional().default(""),
  // event_id generated client-side for Pixel+CAPI dedup
  eventId: z.string().max(64).optional().default(""),
});

export type OrderInput = z.infer<typeof orderSchema>;
