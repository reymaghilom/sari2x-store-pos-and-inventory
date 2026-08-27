import type { DiscountType } from '@/types';

export type DiscountCalculation = {
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  finalTotal: number;
};

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);
const money = (valueInCents: number) => valueInCents / 100;

export function roundMoney(value: number) {
  if (!Number.isFinite(value)) throw new Error('Money value must be a finite number.');
  return money(cents(value));
}

export function validateDiscount(type: DiscountType, value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error('Discount must be a valid non-negative number.');
  if (type === 'percentage' && value > 100) throw new Error('Percentage discount cannot exceed 100%.');
  return type === 'none' ? 0 : type === 'fixed' ? roundMoney(value) : value;
}

export function calculateDiscount(subtotalValue: number, type: DiscountType, value: number, applied = true): DiscountCalculation {
  if (!Number.isFinite(subtotalValue) || subtotalValue < 0) throw new Error('Subtotal must be a valid non-negative number.');
  const subtotalCents = cents(subtotalValue);
  const discountValue = validateDiscount(type, value);
  const effectiveType: DiscountType = applied && type !== 'none' && discountValue > 0 ? type : 'none';
  const discountCents = effectiveType === 'percentage'
    ? Math.min(subtotalCents, Math.round(subtotalCents * discountValue / 100))
    : effectiveType === 'fixed'
      ? Math.min(subtotalCents, cents(discountValue))
      : 0;
  return {
    subtotal: money(subtotalCents),
    discountType: effectiveType,
    discountValue: effectiveType === 'none' ? 0 : discountValue,
    discountAmount: money(discountCents),
    finalTotal: money(Math.max(0, subtotalCents - discountCents)),
  };
}

export function discountLabel(type: DiscountType, value: number, currency: (amount: number) => string) {
  if (type === 'percentage') return `Suki Discount (${Number.isInteger(value) ? value : value.toFixed(2)}%)`;
  if (type === 'fixed') return `Suki Discount (${currency(value)})`;
  return 'Discount';
}
