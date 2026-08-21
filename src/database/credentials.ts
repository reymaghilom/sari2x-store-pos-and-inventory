import * as Crypto from 'expo-crypto';
export async function hashCredential(username: string, password: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `sari-sari-store:${username.toLowerCase()}:${password}`);
}
