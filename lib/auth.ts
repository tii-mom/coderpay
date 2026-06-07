import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { readSessionEmail } from "./session";

export async function getSessionUser(req: NextRequest) {
  const sessionEmail = await readSessionEmail(req.cookies.get("session_email")?.value);
  if (!sessionEmail) return null;
  
  const user = await prisma.user.findUnique({
    where: { email: sessionEmail }
  });
  
  return user;
}
