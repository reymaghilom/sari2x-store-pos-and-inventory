import { getRemainingCredit, isCreditChargeAllowed, isUtangCheckoutAllowed } from '../src/database/repositories/customerCredit.ts';

const cases = [
  { limit: 1000, outstanding: 0, remaining: 1000 },
  { limit: 1000, outstanding: 250, remaining: 750 },
  { limit: 500, outstanding: 500, remaining: 0 },
  { limit: 500, outstanding: 700, remaining: 0 },
];
for (const fixture of cases) {
  if (getRemainingCredit(fixture.limit, fixture.outstanding) !== fixture.remaining) throw new Error(`Remaining-credit fixture failed: ${JSON.stringify(fixture)}`);
}
if (!isCreditChargeAllowed(90, 90) || isCreditChargeAllowed(90, 90.01) || isCreditChargeAllowed(90, -1)) throw new Error('Discounted Utang credit boundary failed.');
if (isUtangCheckoutAllowed(false, 1000, 10) || !isUtangCheckoutAllowed(true, 500, 490) || isUtangCheckoutAllowed(true, 500, 500.01)) throw new Error('Allow Utang permission boundary failed.');
console.log(`Customer credit OK: ${cases.length} limit/outstanding/remaining fixtures, independent permission, and discounted checkout boundary validated`);
