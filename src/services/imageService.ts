import * as FileSystem from 'expo-file-system/legacy';

// The backend limits the complete base64 data URL to 8 MB. A base64 payload
// is larger than the original file, so keep the source image below 5.5 MB.
const MAX_IMAGE_BYTES = 5_500_000;

export const readImageAsDataUrl = async (uri: string): Promise<string> => {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error('La imagen seleccionada ya no está disponible. Elige otra fotografía.');
  if (typeof info.size === 'number' && info.size > MAX_IMAGE_BYTES) {
    throw new Error('La imagen es demasiado grande. Elige una fotografía de menos de 5,5 MB.');
  }
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  if (!base64 || Math.ceil(base64.length * 3 / 4) > MAX_IMAGE_BYTES) {
    throw new Error('La imagen es demasiado grande para analizarla. Elige otra fotografía.');
  }
  const mime = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
};
