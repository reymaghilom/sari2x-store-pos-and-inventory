import { PaperWidth } from '@/services/printerSettings';
import { SaleReceipt } from '@/types';
import { formatStoredDate } from '@/utils/date';
import { discountLabel } from '@/utils/discount';

const ESC = 0x1b; const GS = 0x1d;
const charsFor = (paper: PaperWidth) => paper === '80mm' ? 48 : 32;
const money = (value: number) => `PHP ${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const clean = (value: string) => value.normalize('NFKD').replace(/[^ -~]/g, '?');
const line = (character: string, width: number) => character.repeat(width);

function wrap(value: string, width: number) {
  const words = clean(value).split(/\s+/).filter(Boolean); const lines: string[] = []; let current = '';
  for (const word of words) {
    if (word.length > width) {
      if (current) { lines.push(current); current = ''; }
      for (let index = 0; index < word.length; index += width) lines.push(word.slice(index, index + width));
    } else if (!current) current = word;
    else if (current.length + word.length + 1 <= width) current += ` ${word}`;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current); return lines.length ? lines : [''];
}

function columns(left: string, right: string, width: number) {
  const safeRight = clean(right).slice(0, width); const available = Math.max(1, width - safeRight.length - 1);
  const leftLines = wrap(left, available);
  return leftLines.map((part, index) => index === leftLines.length - 1 ? `${part}${' '.repeat(Math.max(1, width - part.length - safeRight.length))}${safeRight}` : part).join('\n');
}

function encode(value: string) { return Array.from(clean(value)).map((character) => character.charCodeAt(0)); }
function text(bytes: number[], value: string) { bytes.push(...encode(value), 0x0a); }

export function formatEscPosReceipt(receipt: SaleReceipt, paper: PaperWidth, autoCut: boolean) {
  const width = charsFor(paper); const bytes: number[] = [ESC, 0x40, ESC, 0x61, 0x01, ESC, 0x45, 0x01, GS, 0x21, 0x11];
  text(bytes, receipt.storeName); bytes.push(GS, 0x21, 0x00, ESC, 0x45, 0x00);
  if (receipt.storeAddress) for (const part of wrap(receipt.storeAddress, width)) text(bytes, part);
  if (receipt.storePhone) text(bytes, receipt.storePhone);
  if (receipt.status !== 'Completed' && receipt.status !== 'Held') { bytes.push(ESC, 0x45, 0x01); text(bytes, `*** ${receipt.status.toUpperCase()} ***`); bytes.push(ESC, 0x45, 0x00); }
  bytes.push(ESC, 0x61, 0x00); text(bytes, line('-', width));
  text(bytes, columns('Transaction No.', receipt.transactionNumber, width));
  const date = new Date(receipt.createdAt); text(bytes, columns('Date', Number.isNaN(date.getTime()) ? receipt.createdAt : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }), width));
  text(bytes, columns('Cashier', receipt.cashier, width)); if (receipt.customer) text(bytes, columns('Customer', receipt.customer, width)); text(bytes, line('-', width));
  for (const item of receipt.items) {
    for (const part of wrap(item.productName, width)) text(bytes, part);
    text(bytes, columns(`${item.quantity} x ${money(item.unitPrice)}`, money(item.lineTotal), width));
  }
  text(bytes, line('-', width)); text(bytes, columns('Subtotal', money(receipt.subtotal), width)); if (receipt.discount > 0) text(bytes, columns(discountLabel(receipt.discountType, receipt.discountValue, money), `-${money(receipt.discount)}`, width));
  bytes.push(ESC, 0x45, 0x01); text(bytes, columns('TOTAL', money(receipt.total), width)); bytes.push(ESC, 0x45, 0x00);
  text(bytes, columns('Payment', receipt.paymentMethod, width));
  if (receipt.paymentMethod === 'Cash') { text(bytes, columns('Cash received', money(receipt.cashReceived ?? receipt.total), width)); text(bytes, columns('Change', money(receipt.change ?? 0), width)); }
  if ((receipt.paymentMethod === 'GCash' || receipt.paymentMethod === 'Maya') && receipt.reference) text(bytes, columns('Reference', receipt.reference, width));
  if (receipt.paymentMethod === 'Utang') { text(bytes, columns('Credit amount', money(receipt.total), width)); text(bytes, columns('Due date', formatStoredDate(receipt.dueDate) || 'Not set', width)); if (receipt.notes) for (const part of wrap(`Notes: ${receipt.notes}`, width)) text(bytes, part); }
  if (receipt.reversalReason) { text(bytes, line('-', width)); text(bytes, columns('Reversal', receipt.reversalReason, width)); if (receipt.refundAmount !== undefined) text(bytes, columns('Refund', money(receipt.refundAmount), width)); if (receipt.refundMethod) text(bytes, columns('Method', receipt.refundMethod, width)); if (receipt.reversedBy) text(bytes, columns('Reversed by', receipt.reversedBy, width)); }
  text(bytes, line('-', width)); bytes.push(ESC, 0x61, 0x01, ESC, 0x45, 0x01); text(bytes, 'Thank you!'); bytes.push(ESC, 0x45, 0x00); text(bytes, 'Please come again.');
  bytes.push(0x0a, 0x0a, 0x0a); if (autoCut) bytes.push(GS, 0x56, 0x00); return bytes;
}

export function formatEscPosTest(paper: PaperWidth, autoCut: boolean) {
  const width = charsFor(paper); const bytes = [ESC, 0x40, ESC, 0x61, 0x01, ESC, 0x45, 0x01]; text(bytes, 'Sari-sari Store'); bytes.push(ESC, 0x45, 0x00); text(bytes, 'Printer Test'); text(bytes, line('-', width));
  for (const part of wrap('Bluetooth printer connected successfully.', width)) text(bytes, part);
  text(bytes, new Date().toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })); text(bytes, `Paper: ${paper}`); bytes.push(0x0a, 0x0a, 0x0a); if (autoCut) bytes.push(GS, 0x56, 0x00); return bytes;
}
