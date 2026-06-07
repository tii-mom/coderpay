import { NextRequest } from "next/server";
import { prisma } from "./prisma";

export async function getSessionUser(req: NextRequest) {
  const sessionEmail = req.cookies.get("session_email")?.value;
  if (!sessionEmail) return null;
  
  const user = await prisma.user.findUnique({
    where: { email: sessionEmail }
  });
  
  return user;
}
