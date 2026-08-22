import { getLocalSetting, getSetting, setLocalSetting, setSetting } from '@/database/repositories/settings';
import { PaymentMethod } from '@/types';

export type StoreInformation = { storeName: string; ownerName: string; address: string; phone: string };
export type PaymentMethodSettings = Record<PaymentMethod, boolean>;
export type ScannerPreferences = { sound: boolean; vibrate: boolean; torchDefault: boolean; autoAdd: boolean };
export type AppearancePreference = 'light' | 'dark' | 'system';

export const defaultPaymentMethods: PaymentMethodSettings = { Cash: true, GCash: true, Maya: true, Utang: true };
export const defaultScannerPreferences: ScannerPreferences = { sound: true, vibrate: true, torchDefault: false, autoAdd: false };

function parseObject<T extends object>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return { ...fallback, ...JSON.parse(value) }; } catch { return fallback; }
}

export async function getStoreInformation(): Promise<StoreInformation> {
  const [storeName, ownerName, address, phone] = await Promise.all([getSetting('store_name'), getSetting('owner_name'), getSetting('store_address'), getSetting('store_phone')]);
  return { storeName: storeName?.trim() || 'Sari-sari Store', ownerName: ownerName?.trim() || 'Owner', address: address ?? '', phone: phone ?? '' };
}

export async function saveStoreInformation(value: StoreInformation) {
  await setSetting('store_name', value.storeName.trim());
  await setSetting('owner_name', value.ownerName.trim());
  await setSetting('store_address', value.address.trim());
  await setSetting('store_phone', value.phone.trim());
}

export async function getPaymentMethodSettings() {
  return parseObject(await getSetting('payment_methods'), defaultPaymentMethods);
}
export async function savePaymentMethodSettings(value: PaymentMethodSettings) { await setSetting('payment_methods', JSON.stringify(value)); }

export async function getScannerPreferences() {
  return parseObject(await getSetting('scanner_preferences'), defaultScannerPreferences);
}
export async function saveScannerPreferences(value: ScannerPreferences) { await setSetting('scanner_preferences', JSON.stringify(value)); }

export async function getAppearancePreference(): Promise<AppearancePreference> {
  const value = await getLocalSetting('appearance_preference');
  return value === 'light' || value === 'dark' ? value : 'system';
}
export async function saveAppearancePreference(value: AppearancePreference) { await setLocalSetting('appearance_preference', value); }
