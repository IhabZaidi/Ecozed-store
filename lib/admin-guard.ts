import { jwtVerify } from "jose";

/** True when the request carries a valid admin session cookie. */
export async function requireAdmin(req: Request): Promise<boolean> {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!m) return false;
  try {
    await jwtVerify(
      m[1],
      new TextEncoder().encode(
        process.env.ADMIN_SESSION_SECRET || "dev-secret-change-me-please-1234"
      )
    );
    return true;
  } catch {
    return false;
  }
}
