import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const PRODUCT_IMAGES_FOLDER = 'product-images';

function productImagesDirectory() {
  return new Directory(Paths.document, PRODUCT_IMAGES_FOLDER);
}

function extensionFor(fileName?: string | null, mimeType?: string | null) {
  const named = fileName?.toLowerCase().match(/\.(jpe?g|png|webp|heic|heif)$/)?.[1];
  if (named) return named === 'jpeg' ? 'jpg' : named;
  const byMime: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' };
  return mimeType ? byMime[mimeType.toLowerCase()] ?? 'jpg' : 'jpg';
}

export function isAppOwnedProductImage(uri: string | null | undefined) {
  const directoryUri = productImagesDirectory().uri;
  const prefix = directoryUri.endsWith('/') ? directoryUri : `${directoryUri}/`;
  return Boolean(uri?.startsWith(prefix));
}

export function persistProductImage(sourceUri: string, fileName?: string | null, mimeType?: string | null) {
  if (!sourceUri) throw new Error('The selected image did not provide a readable file.');
  const directory = productImagesDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, `${Crypto.randomUUID()}.${extensionFor(fileName, mimeType)}`);
  new File(sourceUri).copy(destination);
  if (!destination.exists) throw new Error('The selected image could not be copied into app storage.');
  return destination.uri;
}

export function deleteProductImage(uri: string | null | undefined) {
  if (!uri || !isAppOwnedProductImage(uri)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}

export function deleteTemporaryImage(uri: string | null | undefined) {
  if (!uri) return;
  const cacheUri = Paths.cache.uri.endsWith('/') ? Paths.cache.uri : `${Paths.cache.uri}/`;
  if (!uri.startsWith(cacheUri)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
