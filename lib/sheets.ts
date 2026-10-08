import { google } from "googleapis";
import { getRawSettings } from "./settings";

export async function appendOrderToSheet(row: (string | number)[]) {
  // DB settings first, env fallback (kept for servers that prefer env).
  const s = await getRawSettings([
    "gs_spreadsheet_id",
    "gs_client_email",
    "gs_private_key",
    "gs_tab",
  ]);
  const spreadsheetId =
    s["gs_spreadsheet_id"] || process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "";
  const clientEmail =
    s["gs_client_email"] || process.env.GOOGLE_SHEETS_CLIENT_EMAIL || "";
  const privateKey =
    s["gs_private_key"] || process.env.GOOGLE_SHEETS_PRIVATE_KEY || "";
  if (!spreadsheetId || !clientEmail || !privateKey)
    return { skipped: true };

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const tab =
      s["gs_tab"] || process.env.GOOGLE_SHEETS_TAB_NAME || "Orders";
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tab}!A:Z`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
    return { ok: true };
  } catch (e) {
    console.error("Sheets append failed", e);
    return { ok: false };
  }
}
