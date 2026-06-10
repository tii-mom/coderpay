import { NextRequest } from "next/server";
import { getAuthD1 } from "./auth-d1";
import { readSessionEmail } from "./session";

export async function getSessionUser(req: NextRequest) {
  const sessionEmail = await readSessionEmail(req.cookies.get("session_email")?.value);
  if (!sessionEmail) return null;

  const user = await getAuthD1()
    .prepare(`SELECT * FROM User WHERE email = ? LIMIT 1`)
    .bind(sessionEmail)
    .first<any>();

  return user;
}
