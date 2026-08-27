import * as Crypto from 'expo-crypto';
export const createId = () => Crypto.randomUUID();
export const nowIso = (date = new Date()) => date.toISOString();
