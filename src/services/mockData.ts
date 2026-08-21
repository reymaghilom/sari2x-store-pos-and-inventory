import { CreditRecord, Customer, Product, StaffAccount, Transaction } from '@/types';

export const products: Product[] = [
  { id: '1', name: 'Coca-Cola 1.5L', category: 'Beverages', price: 75, costPrice: 50, stock: 24, icon: '🥤', barcode: '4800361234567', lowStockThreshold: 10, description: 'Coca-Cola soft drink, 1.5 liter bottle.' },
  { id: '2', name: 'Nissin Noodles', category: 'Snacks', price: 12, costPrice: 8, stock: 8, icon: '🍜', barcode: '4800016001012', lowStockThreshold: 10, description: 'Instant noodles, assorted flavor.' },
  { id: '3', name: 'Colgate Toothpaste', category: 'Personal Care', price: 75, costPrice: 58, stock: 20, icon: '🪥', barcode: '4801314012053', lowStockThreshold: 8, description: 'Colgate toothpaste tube.' },
  { id: '4', name: 'Sprite 500ml', category: 'Beverages', price: 28, costPrice: 20, stock: 32, icon: '🍾', barcode: '4801981111211', lowStockThreshold: 10, description: 'Sprite lemon-lime soft drink.' },
  { id: '5', name: 'Champion Detergent', category: 'Household', price: 5, costPrice: 3, stock: 0, icon: '🧼', barcode: '4806500114098', lowStockThreshold: 10, description: 'Single-use detergent sachet.' },
];
export const transactions: Transaction[] = [
  { saleId: 'seed-sale-1004', id: '#TXN1004', time: 'Today, 10:24 AM', amount: 162, cashier: 'Tindera 1', status: 'Completed' },
  { saleId: 'seed-sale-1003', id: '#TXN1003', time: 'Today, 9:18 AM', amount: 75, cashier: 'Tindera 2', status: 'Completed' },
  { saleId: 'seed-sale-1002', id: '#TXN1002', time: 'Yesterday, 5:42 PM', amount: 340, cashier: 'Admin', status: 'Held' },
];
export const initialCustomers: Customer[] = [
  { id: 'juan', name: 'Juan Dela Cruz', phone: '0917 123 4567', address: 'Purok 2, Barangay Mabini', creditLimit: 3000, utang: 1250 },
  { id: 'maria', name: 'Maria Santos', phone: '0918 555 0182', address: 'Rizal Street', creditLimit: 2000, utang: 750 },
  { id: 'pedro', name: 'Pedro Reyes', phone: '0920 312 9988', address: 'Market Road', creditLimit: 4000, utang: 2400 },
  { id: 'ana', name: 'Ana Lopez', phone: '0916 800 4402', creditLimit: 2500, utang: 1000 },
  { id: 'robert', name: 'Robert Garcia', phone: '0998 200 1234', creditLimit: 3500, utang: 0 },
];
export const initialCredits: CreditRecord[] = [
  { id: 'credit-1', customerId: 'juan', date: 'Aug 10, 2026', dueDate: 'Aug 17, 2026', description: 'Store groceries', amount: 1750, remaining: 1250, status: 'Overdue' },
  { id: 'credit-2', customerId: 'maria', date: 'Aug 15, 2026', dueDate: 'Aug 25, 2026', description: 'Household items', amount: 750, remaining: 750, status: 'Due' },
  { id: 'credit-3', customerId: 'pedro', date: 'Aug 12, 2026', dueDate: 'Aug 19, 2026', description: 'Assorted goods', amount: 2400, remaining: 2400, status: 'Overdue' },
  { id: 'credit-4', customerId: 'ana', date: 'Aug 14, 2026', dueDate: 'Aug 28, 2026', description: 'Store purchase', amount: 1000, remaining: 1000, status: 'Due' },
  { id: 'credit-5', customerId: 'robert', date: 'Aug 1, 2026', dueDate: 'Aug 8, 2026', description: 'Paid purchase', amount: 450, remaining: 0, status: 'Paid' },
];
export const initialStaff: StaffAccount[] = [
  { id: 'admin-1', name: 'Admin', username: 'admin', role: 'admin', active: true },
  { id: 'staff-1', name: 'Tindera 1', username: 'tindera1', role: 'staff', active: true },
  { id: 'staff-2', name: 'Tindera 2', username: 'tindera2', role: 'staff', active: true },
];
