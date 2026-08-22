# Bluetooth thermal printing

Direct printing uses the Android-only local Expo module in `modules/bluetooth-escpos`. It opens the standard Bluetooth Classic serial/RFCOMM channel and writes ESC/POS bytes generated in TypeScript. No Bluetooth printer package or cloud service is involved.

This strategy was chosen after reviewing the available packages: the generic Bluetooth Classic library still has open New Architecture and modern Android receiver issues, while the common all-in-one ESC/POS package documents legacy manual linking and labels itself under development. A small app-local module keeps the Android API surface auditable and follows Expo's recommended native-code approach: https://docs.expo.dev/workflow/customizing/

Expo Go does not contain this native module. The rest of the application remains usable in Expo Go with:

```powershell
npx expo start --go
```

Printer Setup will explain that direct printing is unavailable. Use a development build or standalone APK to test the printer.

Expo development-build reference: https://docs.expo.dev/develop/development-builds/introduction/

## EAS development build (no Android Studio required)

```powershell
npm install
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform android
npx expo start --dev-client
```

Install the APK produced by EAS on the Android phone, launch it, and connect it to the development server.

## Local Android build (Android SDK required)

```powershell
npm install
npx expo prebuild --platform android
npx expo run:android --device
npx expo start --dev-client
```

Rebuild the native app after changing Kotlin code, Android permissions, or native dependencies.

## Physical printer checklist

1. Pair the Bluetooth Classic thermal printer in Android system Bluetooth settings. Common PINs are printer-specific.
2. Open Settings → Printer Setup.
3. Grant Nearby devices permission when prompted.
4. Tap Refresh Paired Printers and choose the printer.
5. Select 58mm or 80mm paper and disable Auto cut if the printer has no cutter.
6. Tap Connect, then Test Print.
7. Print a new and historical receipt. Verify wrapping, totals, Cash/GCash/Maya/Utang details, feed, and cut behavior.
8. Print a voided/refunded receipt and confirm the prominent status and reversal information.
9. Repeat with internet disabled. Printing reads only persisted SQLite receipt snapshots.
10. Turn off or move the printer out of range and confirm the app reports the failure without changing the sale.

The module lists paired devices only. It intentionally does not run Bluetooth discovery, so Android location and `BLUETOOTH_SCAN` permissions are not requested. Android 12 and newer request `BLUETOOTH_CONNECT` only when printer functionality is used; older versions use manifest-declared legacy Bluetooth permissions.
