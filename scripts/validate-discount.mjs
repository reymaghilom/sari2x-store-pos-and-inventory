import { calculateDiscount } from '../src/utils/discount.ts';

const cases = [
  { subtotal: 100, type: 'none', value: 0, discount: 0, total: 100 },
  { subtotal: 199.99, type: 'percentage', value: 10, discount: 20, total: 179.99 },
  { subtotal: 25, type: 'fixed', value: 5.55, discount: 5.55, total: 19.45 },
  { subtotal: 10, type: 'fixed', value: 50, discount: 10, total: 0 },
  { subtotal: 0.05, type: 'percentage', value: 10, discount: 0.01, total: 0.04 },
];

for (const fixture of cases) {
  const actual = calculateDiscount(fixture.subtotal, fixture.type, fixture.value);
  if (actual.discountAmount !== fixture.discount || actual.finalTotal !== fixture.total) {
    throw new Error(`Discount fixture failed: ${JSON.stringify({ fixture, actual })}`);
  }
}

for (const fixture of [
  { type: 'percentage', value: 100.01 },
  { type: 'fixed', value: -0.01 },
  { type: 'percentage', value: Number.NaN },
]) {
  let rejected = false;
  try { calculateDiscount(100, fixture.type, fixture.value); } catch { rejected = true; }
  if (!rejected) throw new Error(`Invalid discount was accepted: ${JSON.stringify(fixture)}`);
}

console.log(`Discount calculator OK: ${cases.length} cents-safe none/percentage/fixed/capped/rounding fixtures and invalid boundaries validated`);
