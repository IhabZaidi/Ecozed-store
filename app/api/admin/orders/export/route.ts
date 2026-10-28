import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { orders } from "@/lib/schema";
import { desc } from "drizzle-orm";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

// Template column headers in exact order (A-T)
const TEMPLATE_HEADERS: string[] = [
  "reference commande",
  "nom et prenom du destinataire*",
  "telephone*",
  "telephone 2",
  "code wilaya*",
  "wilaya de livraison",
  "commune de livraison*",
  "adresse de livraison*",
  "produit*",
  "poids (kg)",
  "montant du colis*",
  "remarque",
  "FRAGILE\n( si oui mettez OUI sinon laissez vide )",
  "ECHANGE\n( si oui mettez OUI sinon laissez vide )",
  "PICK UP\n( si oui mettez OUI sinon laissez vide )",
  "RECOUVREMENT\n( si oui mettez OUI sinon laissez vide )",
  "STOP DESK\n( si oui mettez OUI sinon laissez vide )",
  "Lien map",
  "Quantity",
  "Confirme",
];

/**
 * GET → downloads all orders as an Excel file matching the daily_orders template format.
 * Template has 20 columns (A-T):
 * 0: reference commande
 * 1: nom et prenom du destinataire* : fullName
 * 2: telephone* : phone
 * 3: telephone 2
 * 4: code wilaya* : wilayaCode
 * 5: wilaya de livraison
 * 6: commune de livraison* : commune
 * 7: adresse de livraison* : address
 * 8: produit* : productTitle
 * 9: poids (kg)
 * 10: montant du colis* : total (DZD)
 * 11: remarque
 * 12: FRAGILE : empty (not tracked in our orders)
 * 13: ECHANGE : empty
 * 14: PICK UP : empty
 * 15: RECOUVREMENT : empty
 * 16: STOP DESK : "OUI" if delivery === "stopdesk", else empty
 * 17: Lien map
 * 18: Quantity : qty
 * 19: Confirme
 */
export async function GET(req: Request) {
  if (!(await requireAdmin(req)))
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });

  // Fetch all orders from database (newest first)
  const allOrders = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.id));

  // Transform orders to match Excel template format (20 columns A-T)
  const rows = allOrders.map((o) => ({
    "reference commande": "",
    "nom et prenom du destinataire*": o.fullName,
    "telephone*": o.phone,
    "telephone 2": "",
    "code wilaya*": Number(o.wilayaCode),
    "wilaya de livraison": "",
    "commune de livraison*": o.commune,
    "adresse de livraison*": o.address || "",
    "produit*": o.productTitle,
    "poids (kg)": "",
    "montant du colis*": o.total,
    "remarque": "",
    "FRAGILE\n( si oui mettez OUI sinon laissez vide )": "",
    "ECHANGE\n( si oui mettez OUI sinon laissez vide )": "",
    "PICK UP\n( si oui mettez OUI sinon laissez vide )": "",
    "RECOUVREMENT\n( si oui mettez OUI sinon laissez vide )": "",
    "STOP DESK\n( si oui mettez OUI sinon laissez vide )":
      o.delivery === "stopdesk" ? "OUI" : "",
    "Lien map": "",
    Quantity: o.qty,
    Confirme: "",
  }));

  // Create workbook and worksheet - explicitly pass headers to ensure they're always written
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: TEMPLATE_HEADERS });

  // Set column widths for better readability (matching template columns A-T)
  const colWidths = [
    { wch: 18 }, // A: reference commande
    { wch: 30 }, // B: nom et prenom
    { wch: 18 }, // C: telephone
    { wch: 18 }, // D: telephone 2
    { wch: 12 }, // E: code wilaya
    { wch: 20 }, // F: wilaya de livraison
    { wch: 25 }, // G: commune
    { wch: 30 }, // H: adresse
    { wch: 25 }, // I: produit
    { wch: 12 }, // J: poids
    { wch: 18 }, // K: montant
    { wch: 20 }, // L: remarque
    { wch: 12 }, // M: FRAGILE
    { wch: 12 }, // N: ECHANGE
    { wch: 12 }, // O: PICK UP
    { wch: 12 }, // P: RECOUVREMENT
    { wch: 12 }, // Q: STOP DESK
    { wch: 20 }, // R: Lien map
    { wch: 10 }, // S: Quantity
    { wch: 12 }, // T: Confirme
  ];
  worksheet["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

  // Generate Excel buffer
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orders-export-${date}.xlsx"`,
    },
  });
}