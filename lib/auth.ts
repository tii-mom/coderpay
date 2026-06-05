import { NextRequest } from "next/server";
import { prisma } from "./prisma";

export async function getSessionUser(req: NextRequest) {
  const sessionEmail = req.cookies.get("session_email")?.value || "yudeyou0118@gmail.com";
  
  let user = await prisma.user.findUnique({
    where: { email: sessionEmail }
  });
  
  if (!user) {
    // If not found, fall back to first user in database
    user = await prisma.user.findFirst();
  }
  
  return user;
}
