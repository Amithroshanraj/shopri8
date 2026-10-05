export function buildDemoQrPayload(orderId: string, amount: number): string {
  return `SHOPRI8-DEMO|ORDER:${orderId}|AMOUNT:${amount.toFixed(2)}|NO-REAL-PAYMENT`;
}
