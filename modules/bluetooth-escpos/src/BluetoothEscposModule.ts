import { requireOptionalNativeModule } from 'expo';

export type BluetoothPrinterDevice = { id: string; name: string; address: string; bonded: boolean };
export type BluetoothEscposNativeModule = {
  isAvailable(): boolean;
  isEnabled(): boolean;
  getPairedDevices(): Promise<BluetoothPrinterDevice[]>;
  connect(address: string): Promise<BluetoothPrinterDevice>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  connectedAddress(): string | null;
  write(bytes: number[]): Promise<void>;
};

// Expo Go does not contain this local module. Returning null preserves every
// non-Bluetooth feature there while the UI explains the development-build need.
export default requireOptionalNativeModule<BluetoothEscposNativeModule>('BluetoothEscpos');
