import { nextTransactionNumber, transactionNumberPrefix } from '../src/database/transactionNumbers.ts';

const date = new Date(2026, 7, 27, 9, 30);
if (transactionNumberPrefix(date) !== 'TXN-082726-') throw new Error('Local date prefix fixture failed.');

function fakeDatabase(maxSequence, collisions = []) {
  return {
    async getFirstAsync(sql, ...args) {
      if (String(sql).includes('MAX(CAST')) return { sequence: maxSequence };
      const candidate = args[0];
      return collisions.includes(candidate) ? { id: `collision-${candidate}` } : null;
    },
  };
}

if (await nextTransactionNumber(fakeDatabase(null), date) !== 'TXN-082726-001') throw new Error('First daily sequence fixture failed.');
if (await nextTransactionNumber(fakeDatabase(7), date) !== 'TXN-082726-008') throw new Error('Increment fixture failed.');
if (await nextTransactionNumber(fakeDatabase(7, ['TXN-082726-008']), date) !== 'TXN-082726-009') throw new Error('Collision retry fixture failed.');
let exhausted = false;
try { await nextTransactionNumber(fakeDatabase(999), date); } catch { exhausted = true; }
if (!exhausted) throw new Error('Daily sequence exhaustion fixture failed.');

console.log('Transaction numbers OK: local date prefix, first/increment/collision, persistence query, and daily exhaustion fixtures validated');
