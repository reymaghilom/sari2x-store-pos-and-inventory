# Sari-sari Store

Android-first React Native/Expo inventory and POS app. Screens always read SQLite, so checkout, inventory, customers, utang, and reports continue working offline. A background layer synchronizes queued local writes with Supabase PostgreSQL when a connection is available.

## Run locally

```bash
npm install
copy .env.example .env
npm start
```

Use `npm run android` for an Android emulator or connected device.

The app has one local Owner identity and a four-digit PIN-only lock screen. On a fresh install—or after migrating an older multi-user database—the temporary development PIN is `1234`. Open Settings > Security > Change Owner PIN before regular use. The PIN hash stays only in local SQLite; prior user rows are retained solely so historical receipts keep their original cashier names.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor, paste all of [`supabase/schema.sql`](supabase/schema.sql), and run it once.
3. In Project Settings > API, copy the project URL and public publishable key into `.env`:

   ```text
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
   EXPO_PUBLIC_ENABLE_DEVELOPMENT_SEED=false
   ```

   Older projects can use `EXPO_PUBLIC_SUPABASE_ANON_KEY` instead. Never put a service-role key, PostgreSQL password, or other private credential in Expo public variables.

4. Apply the authenticated ownership migration and deploy the protected `store-admin` Edge Function by following [`docs/supabase-owner-auth.md`](docs/supabase-owner-auth.md).
5. Restart Expo, unlock with the existing 4-digit PIN, and open Settings > Cloud Backup to create or sign in to the Owner cloud account.

Cloud tables require a server-enrolled Supabase Auth Owner and are scoped by `owner_id = auth.uid()`. Anonymous development policies are removed by migration `004_authenticated_owner_cloud.sql`. The service-role credential exists only in the hosted Edge Function runtime.

## Synchronization behavior

- Local writes commit to SQLite and `sync_queue` first. Checkout never waits for the network.
- When the secure Owner cloud session is available, sync pushes owner-scoped pending records in table batches, then pulls only that Owner's rows newer than the local pull cursor.
- Stable IDs make retries idempotent. Sales, sale items, stock movements, and credit payments are immutable inserts; editable records use last-write-wins by UTC `updated_at`.
- Stock quantity is never uploaded from `products.cached_stock`. It is recomputed from every unique `stock_movement`, so offline movements from multiple devices coexist.
- A persistent UUID device ID and sync timestamps/counts live in local settings. Sync runs at startup, after reconnect, shortly after important writes, and on manual request; a lock prevents overlapping runs.
- On first cloud bootstrap, existing cloud business data removes local development samples before pulling. Production builds do not create business sample data. The Owner PIN remains available for offline unlock.
- If the Owner cloud session is missing, local writes remain queued and POS stays usable offline. Failed queue entries retain their status and retry count for manual retry.

Reports remain local SQLite queries and refresh after a successful cloud pull.

## Product images

Selected product images are copied into the app's persistent `product-images` document directory and their local URI is stored in SQLite `products.image_uri`. Supabase backs up the remaining product metadata, but it does not currently back up the physical image file or synchronize device-local image URIs. A restored product therefore uses its normal placeholder until an image is selected again on the phone.

## Barcode scanning

The scanner uses `expo-camera` and requests camera permission only when the scanner screen is opened. Barcode lookup is an exact, offline SQLite query; the scanner never queries Supabase directly. POS mode can add an in-stock result to the existing cart, Inventory mode opens Product Details, and input mode returns the scanned value to the Add/Edit Product form. Non-empty product barcodes are protected by the existing SQLite and Supabase unique constraints.

Supabase Auth is used only for cloud ownership and administration. The normal app lock remains the local four-digit Owner PIN. Payment gateways and product-photo cloud storage are not included.

## Owner PIN recovery

There is intentionally no backdoor or displayed recovery PIN. If the Owner PIN is forgotten, first confirm that cloud backup is current from a device that is still unlocked. Then reinstall/reset the app, unlock with the temporary PIN `1234`, immediately change it, and let Backup & Sync restore the business records. Resetting app storage without a verified backup permanently removes unsynced local data.

## Validation

```bash
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform android --output-dir dist-android
python scripts/validate-schema.py
npm run check:supabase-security
npm run check:edge
npm run check:edge-logic
npm run check:backup
```
