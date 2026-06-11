export type RechargeStatus = "pending" | "success" | "expired" | "failed";

export function getRechargeDisplayStatus(
  order: { status: string; expiresAt?: Date | string | null },
  now: Date = new Date()
): RechargeStatus {
  if (order.status === "pending" && order.expiresAt && new Date(order.expiresAt).getTime() <= now.getTime()) {
    return "expired";
  }
  if (order.status === "success" || order.status === "failed" || order.status === "expired") {
    return order.status;
  }
  return "pending";
}
