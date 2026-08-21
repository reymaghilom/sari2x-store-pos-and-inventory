import { SaleReceipt } from '@/types';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export class ReceiptActionError extends Error {}

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const currency = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatReceiptDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

function paymentDetails(receipt: SaleReceipt) {
  if (receipt.paymentMethod === 'Cash') {
    return `<div class="row"><span>Cash received</span><strong>${currency(receipt.cashReceived ?? receipt.total)}</strong></div>
      <div class="row"><span>Change</span><strong>${currency(receipt.change ?? 0)}</strong></div>`;
  }
  if (receipt.paymentMethod === 'GCash' || receipt.paymentMethod === 'Maya') {
    return receipt.reference
      ? `<div class="row"><span>Reference</span><strong>${escapeHtml(receipt.reference)}</strong></div>`
      : '';
  }
  const due = receipt.dueDate ? formatReceiptDate(receipt.dueDate) : 'Not set';
  return `<div class="row"><span>Amount charged</span><strong>${currency(receipt.total)}</strong></div>
    <div class="row"><span>Due date</span><strong>${escapeHtml(due)}</strong></div>`;
}

export function buildReceiptHtml(receipt: SaleReceipt) {
  const items = receipt.items.map((item) => `<div class="item">
      <div class="item-name">${escapeHtml(item.productName)}</div>
      <div class="row"><span>${item.quantity} × ${currency(item.unitPrice)}</span><strong>${currency(item.lineTotal)}</strong></div>
    </div>`).join('');
  const address = receipt.storeAddress ? `<div>${escapeHtml(receipt.storeAddress)}</div>` : '';
  const phone = receipt.storePhone ? `<div>${escapeHtml(receipt.storePhone)}</div>` : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    @page { margin: 5mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111; background: #fff; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; line-height: 1.45; }
    .receipt { width: 100%; }
    .center { text-align: center; }
    .store { margin: 0 0 2px; font-family: Arial, sans-serif; font-size: 17px; font-weight: 700; }
    .muted { color: #444; }
    .divider { margin: 9px 0; border-top: 1px dashed #555; }
    .row { display: flex; justify-content: space-between; gap: 10px; }
    .row strong { text-align: right; }
    .item { margin: 0 0 7px; }
    .item-name { font-weight: 700; }
    .total { font-size: 13px; }
    .footer { margin-top: 12px; text-align: center; }
  </style>
</head>
<body>
  <main class="receipt">
    <header class="center">
      <h1 class="store">${escapeHtml(receipt.storeName)}</h1>
      ${address}${phone}
    </header>
    <div class="divider"></div>
    <div class="row"><span>Transaction</span><strong>${escapeHtml(receipt.transactionNumber)}</strong></div>
    <div class="row"><span>Date / time</span><strong>${escapeHtml(formatReceiptDate(receipt.createdAt))}</strong></div>
    <div class="row"><span>Cashier</span><strong>${escapeHtml(receipt.cashier)}</strong></div>
    <div class="row"><span>Customer</span><strong>${escapeHtml(receipt.customer)}</strong></div>
    <div class="divider"></div>
    ${items}
    <div class="divider"></div>
    <div class="row"><span>Subtotal</span><strong>${currency(receipt.subtotal)}</strong></div>
    <div class="row"><span>Discount</span><strong>${currency(receipt.discount)}</strong></div>
    <div class="row total"><strong>Total</strong><strong>${currency(receipt.total)}</strong></div>
    <div class="row"><span>Payment</span><strong>${escapeHtml(receipt.paymentMethod)}</strong></div>
    ${paymentDetails(receipt)}
    <div class="divider"></div>
    <footer class="footer"><strong>Thank you!</strong><br>Please come again.</footer>
  </main>
</body>
</html>`;
}

export async function createReceiptPdf(receipt: SaleReceipt) {
  const estimatedHeight = Math.max(520, 430 + receipt.items.length * 52);
  try {
    return await Print.printToFileAsync({ html: buildReceiptHtml(receipt), width: 226, height: estimatedHeight });
  } catch {
    throw new ReceiptActionError('The receipt PDF could not be generated on this device.');
  }
}

export async function shareReceiptPdf(receipt: SaleReceipt) {
  if (!(await Sharing.isAvailableAsync())) throw new ReceiptActionError('Sharing is not available on this device.');
  const { uri } = await createReceiptPdf(receipt);
  try {
    await Sharing.shareAsync(uri, {
      dialogTitle: `Share receipt ${receipt.transactionNumber}`,
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
  } catch {
    throw new ReceiptActionError('The native share sheet could not be opened.');
  }
}

export async function printReceipt(receipt: SaleReceipt) {
  try {
    await Print.printAsync({ html: buildReceiptHtml(receipt) });
  } catch {
    throw new ReceiptActionError('The native print dialog could not be opened. Make sure a print service is available.');
  }
}
