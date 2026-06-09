-- Enforce one order per (appId, outOrderNo) so concurrent create requests
-- with the same merchant order number cannot produce duplicate orders.
CREATE UNIQUE INDEX "Order_appId_outOrderNo_key" ON "Order"("appId", "outOrderNo");
