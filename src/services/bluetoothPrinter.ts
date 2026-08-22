import BluetoothEscpos, { BluetoothPrinterDevice } from '../../modules/bluetooth-escpos';
import { formatEscPosReceipt, formatEscPosTest } from '@/services/escpos';
import { getPrinterSettings } from '@/services/printerSettings';
import { SaleReceipt } from '@/types';
import { PermissionsAndroid, Platform } from 'react-native';

export class BluetoothPrinterError extends Error {
  constructor(message: string, readonly code: 'UNAVAILABLE' | 'PERMISSION' | 'BLUETOOTH_OFF' | 'NOT_CONFIGURED' | 'CONNECT' | 'PRINT') { super(message); }
}

function moduleOrThrow() {
  if (Platform.OS !== 'android' || !BluetoothEscpos) throw new BluetoothPrinterError('Direct Bluetooth printing requires an Android development or standalone build. Other app features still work in Expo Go.', 'UNAVAILABLE');
  if (!BluetoothEscpos.isAvailable()) throw new BluetoothPrinterError('This device does not support Bluetooth Classic.', 'UNAVAILABLE');
  return BluetoothEscpos;
}

export function isBluetoothPrinterModuleAvailable() { return Platform.OS === 'android' && Boolean(BluetoothEscpos); }

export async function requestBluetoothPrinterPermission() {
  if (Platform.OS !== 'android') throw new BluetoothPrinterError('Bluetooth thermal printing is currently available on Android only.', 'UNAVAILABLE');
  if (Platform.Version < 31) return true;
  const permission = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
  const existing = await PermissionsAndroid.check(permission);
  if (existing) return true;
  const result = await PermissionsAndroid.request(permission, { title: 'Bluetooth printer permission', message: 'Allow Sari-sari Store to connect to printers already paired with this phone.', buttonPositive: 'Allow', buttonNegative: 'Not now' });
  if (result !== PermissionsAndroid.RESULTS.GRANTED) throw new BluetoothPrinterError('Bluetooth permission was denied. Allow Nearby devices access in Android Settings to use direct printing.', 'PERMISSION');
  return true;
}

function friendly(error: unknown, fallbackCode: BluetoothPrinterError['code']): never {
  if (error instanceof BluetoothPrinterError) throw error;
  const message = error instanceof Error ? error.message : '';
  if (/turned off/i.test(message)) throw new BluetoothPrinterError('Bluetooth is turned off. Turn it on, then try again.', 'BLUETOOTH_OFF');
  if (/permission/i.test(message)) throw new BluetoothPrinterError('Bluetooth permission is required. Allow Nearby devices access, then try again.', 'PERMISSION');
  if (/timed out/i.test(message)) throw new BluetoothPrinterError('The printer did not respond in time. Check that it is powered on and nearby.', 'CONNECT');
  if (/paired/i.test(message)) throw new BluetoothPrinterError('The selected printer is not paired with this phone. Pair it in Android Bluetooth settings first.', 'CONNECT');
  if (/disconnected/i.test(message)) throw new BluetoothPrinterError('The printer disconnected during printing. Reconnect it and try again.', 'PRINT');
  throw new BluetoothPrinterError(fallbackCode === 'PRINT' ? 'The printer could not receive the receipt. Check its power, paper, and connection.' : 'Could not connect to the Bluetooth printer.', fallbackCode);
}

export async function listPairedPrinters(): Promise<BluetoothPrinterDevice[]> {
  try { await requestBluetoothPrinterPermission(); return await moduleOrThrow().getPairedDevices(); }
  catch (error) { return friendly(error, 'CONNECT'); }
}

export async function connectBluetoothPrinter(address: string) {
  try { await requestBluetoothPrinterPermission(); return await moduleOrThrow().connect(address); }
  catch (error) { return friendly(error, 'CONNECT'); }
}
export async function disconnectBluetoothPrinter() { try { await moduleOrThrow().disconnect(); } catch (error) { return friendly(error, 'CONNECT'); } }
export function bluetoothPrinterConnection() {
  if (!BluetoothEscpos) return { connected: false, address: null as string | null };
  return { connected: BluetoothEscpos.isConnected(), address: BluetoothEscpos.connectedAddress() };
}

async function ensureConfiguredConnection() {
  await requestBluetoothPrinterPermission(); const native = moduleOrThrow(); const settings = await getPrinterSettings();
  if (!settings.selectedId) throw new BluetoothPrinterError('No Bluetooth printer is configured.', 'NOT_CONFIGURED');
  if (!native.isEnabled()) throw new BluetoothPrinterError('Bluetooth is turned off. Turn it on, then try again.', 'BLUETOOTH_OFF');
  if (!native.isConnected() || native.connectedAddress() !== settings.selectedId) await native.connect(settings.selectedId);
  return { native, settings };
}

export async function printReceiptToBluetooth(receipt: SaleReceipt) {
  try { const { native, settings } = await ensureConfiguredConnection(); await native.write(formatEscPosReceipt(receipt, settings.paperWidth, settings.autoCut)); }
  catch (error) { return friendly(error, 'PRINT'); }
}
export async function printBluetoothTest() {
  try { const { native, settings } = await ensureConfiguredConnection(); await native.write(formatEscPosTest(settings.paperWidth, settings.autoCut)); }
  catch (error) { return friendly(error, 'PRINT'); }
}
