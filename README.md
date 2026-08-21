# Sari-sari Store

Android-first React Native/Expo inventory and POS app. Screens always read SQLite, so checkout, inventory, customers, utang, and reports continue working offline. A background layer synchronizes queued local writes with Supabase PostgreSQL when a connection is available.

## Run locally

```bash
npm install
copy .env.example .env
npm start
```

Use `npm run android` for an Android emulator or connected device.

Development logins are `admin` / `admin123`, `tindera1` / `1234`, and `tindera2` / `1234`. Password hashes stay only in local SQLite; cloud `users` contains profile, role, and status metadata, not credentials.

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

4. Restart Expo after changing environment variables. Sign in as admin and open Settings > Backup & Sync.

The SQL enables RLS but includes permissive `anon` policies explicitly labeled development-only because this phase intentionally keeps offline local login and does not use Supabase Auth. Before production, add Supabase Auth plus a `store_id`/membership model, replace every `dev_shared_*` policy with membership-scoped policies, and remove anonymous write access.

## Synchronization behavior

- Local writes commit to SQLite and `sync_queue` first. Checkout never waits for the network.
- Sync pushes pending records in table batches, then pulls rows newer than the local pull cursor and applies them through SQLite repositories.
- Stable IDs make retries idempotent. Sales, sale items, stock movements, and credit payments are immutable inserts; editable records use last-write-wins by UTC `updated_at`.
- Stock quantity is never uploaded from `products.cached_stock`. It is recomputed from every unique `stock_movement`, so offline movements from multiple devices coexist.
- A persistent UUID device ID and sync timestamps/counts live in local settings. Sync runs at startup, after reconnect, shortly after important writes, and on manual request; a lock prevents overlapping runs.
- On first cloud bootstrap, existing cloud business data removes local development samples before pulling. Production builds do not create business sample data. Local user credentials remain available for offline login.
- Failed queue entries keep their payload/status and retry count. Settings > Backup & Sync provides a manual retry.

Reports remain local SQLite queries and refresh after a successful cloud pull.

## Barcode scanning

The scanner uses `expo-camera` and requests camera permission only when the scanner screen is opened. Barcode lookup is an exact, offline SQLite query; the scanner never queries Supabase directly. POS mode can add an in-stock result to the existing cart, Inventory mode opens Product Details, and input mode returns the scanned value to the Add/Edit Product form. Non-empty product barcodes are protected by the existing SQLite and Supabase unique constraints.

The current phase does not include Supabase Auth, receipt printing, payment gateways, void/refund synchronization, or multi-store isolation.

## Validation

```bash
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform android --output-dir dist-android
python scripts/validate-schema.py
```
