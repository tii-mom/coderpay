export function amountToCents(value: string | number): number {
  const raw = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error("Invalid amount format. Must be a positive number with up to 2 decimal places");
  }

  const [yuan, fraction = ""] = raw.split(".");
  const cents = Number(yuan) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("Amount must be a positive number greater than 0");
  }
  return cents;
}

export function centsToAmount(cents: number): number {
  return cents / 100;
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function legacyAmountToCents(value: number | null | undefined): number {
  return Math.round(Number(value || 0) * 100);
}

export function getOrderAmountCents(order: { amountCents?: number | null; amount: number }): number {
  return order.amountCents ?? legacyAmountToCents(order.amount);
}

export function getOrderRealAmountCents(order: { realAmountCents?: number | null; realAmount: number }): number {
  return order.realAmountCents ?? legacyAmountToCents(order.realAmount);
}
