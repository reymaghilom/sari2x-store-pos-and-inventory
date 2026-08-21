import * as Crypto from 'expo-crypto';
export const createId = () => Crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
