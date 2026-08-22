const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

function readLocalEnv() {
  const file = path.join(process.cwd(), '.env');
  if (!fs.existsSync(file)) return {};
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).reduce((result, line) => {
    const separator = line.indexOf('=');
    if (separator <= 0 || line.trimStart().startsWith('#')) return result;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    result[key] = value;
    return result;
  }, {});
}

function isPrivateKey(key) {
  if (key.startsWith('sb_secret_')) return true;
  const segments = key.split('.');
  if (segments.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8'));
    return payload.role === 'service_role';
  } catch { return false; }
}

async function main() {
  const env = { ...readLocalEnv(), ...process.env };
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = (env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) throw new Error('MISSING_PUBLIC_CONFIG');
  if (isPrivateKey(key)) throw new Error('PRIVATE_KEY_REJECTED');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const tables = ['users', 'categories', 'products', 'customers', 'sales', 'sale_items', 'stock_movements', 'credit_transactions', 'credit_payments', 'sale_voids', 'sale_refunds', 'sale_refund_items', 'settings'];
  const counts = {};
  for (const table of tables) {
    const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`READ_FAILED_${table}_${error.code || 'UNKNOWN'}`);
    counts[table] = count ?? 0;
  }
  console.log(`Supabase read checks passed: ${tables.length} synchronized tables are accessible.`);
  console.log(Object.entries(counts).map(([table, count]) => `${table}=${count}`).join(', '));
}

main().catch((error) => {
  console.error(`Supabase read check failed: ${error instanceof Error ? error.message : 'UNKNOWN'}`);
  process.exitCode = 1;
});
