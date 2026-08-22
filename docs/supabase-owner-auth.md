# Supabase Owner Auth deployment

This project keeps the 4-digit Owner PIN as the everyday local login. Supabase email/password authentication is used only to authorize cloud backup, complete store reset, and restored-snapshot replacement.

## Before deployment

1. In Supabase Dashboard, open **Authentication → Providers → Email** and enable Email/Password.
2. Choose the single email address that will own this store. The address must match exactly in the app and the `STORE_OWNER_EMAIL` Edge Function secret.
3. Keep the Expo app configured with only `EXPO_PUBLIC_SUPABASE_URL` and the publishable key. Never add a secret/service-role key to an `EXPO_PUBLIC_*` variable.

## Apply and deploy

From the project directory:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase secrets set STORE_OWNER_EMAIL=owner@example.com
npx supabase functions deploy store-admin
```

Do not use `--no-verify-jwt`. The function requires a signed-in user JWT. Supabase provides its privileged server key only inside the hosted Edge Function runtime.

## Claim the existing cloud dataset

Migration `004_authenticated_owner_cloud.sql` never deletes or automatically assigns existing records. After deploying:

1. Open **Settings → Cloud Backup**.
2. Create the account using the allowlisted email, or sign in to the existing account.
3. If email confirmation is enabled, confirm the email and then sign in.
4. Tap **Claim Existing Store Backup** once.
5. Run **Sync Now** and verify the status is **Up to date**.

The Edge Function rejects the claim if any cloud record already belongs to a different Owner. The allowlisted email is stored as a Supabase-hosted secret, not in the Expo bundle.

## Snapshot limits

Authoritative restore replacement currently accepts at most 5 MiB and 50,000 synchronized records in one request. Product photos remain local-only. A staged upload protocol should be added before the store approaches either limit.
