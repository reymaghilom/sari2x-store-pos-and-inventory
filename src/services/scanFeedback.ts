import { File, Paths } from 'expo-file-system';

function writeAscii(bytes: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) bytes[offset + index] = value.charCodeAt(index);
}

function writeUint16(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
  bytes[offset + 3] = (value >> 24) & 0xff;
}

function createScanTone() {
  const sampleRate = 16_000;
  const sampleCount = Math.floor(sampleRate * 0.09);
  const bytes = new Uint8Array(44 + sampleCount * 2);
  writeAscii(bytes, 0, 'RIFF');
  writeUint32(bytes, 4, bytes.length - 8);
  writeAscii(bytes, 8, 'WAVEfmt ');
  writeUint32(bytes, 16, 16);
  writeUint16(bytes, 20, 1);
  writeUint16(bytes, 22, 1);
  writeUint32(bytes, 24, sampleRate);
  writeUint32(bytes, 28, sampleRate * 2);
  writeUint16(bytes, 32, 2);
  writeUint16(bytes, 34, 16);
  writeAscii(bytes, 36, 'data');
  writeUint32(bytes, 40, sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) {
    const fade = 1 - index / sampleCount;
    const sample = Math.round(Math.sin((2 * Math.PI * 920 * index) / sampleRate) * 12_000 * fade);
    writeUint16(bytes, 44 + index * 2, sample < 0 ? 65_536 + sample : sample);
  }
  return bytes;
}

export function getScanSoundUri() {
  try {
    const file = new File(Paths.cache, 'sari-scanner-success.wav');
    if (!file.exists) file.write(createScanTone());
    return file.uri;
  } catch {
    return undefined;
  }
}
