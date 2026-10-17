import * as Crypto from 'expo-crypto';

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export const createPasswordSalt = async (): Promise<string> => toHex(await Crypto.getRandomBytesAsync(16));

export const hashPassword = async (password: string, salt: string): Promise<string> => Crypto.digestStringAsync(
  Crypto.CryptoDigestAlgorithm.SHA256,
  `${salt}:${password}`,
);

