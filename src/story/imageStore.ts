import { findImageUsages, type ImageUsageRef } from './imageUsage';
import type { Story } from './types';

export interface StoredImage {
  id: string;
  storyId?: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  width?: number;
  height?: number;
  createdAt: number;
}

export const MAX_IMAGE_EDGE_PX = 1600;
const DB_NAME = 'gnc_images_v1';
const DB_VERSION = 1;
const STORE_NAME = 'images';

const memoryImages = new Map<string, StoredImage>();
const listeners = new Set<() => void>();
let injectedWriteError: string | null = null;

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeImageStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isImageId(value: string | undefined): boolean {
  return typeof value === 'string' && value.startsWith('img_');
}

export function setImageStoreErrorForTests(message: string | null): void {
  injectedWriteError = message;
}

export function clearImageStoreForTests(): void {
  memoryImages.clear();
  injectedWriteError = null;
  notifyListeners();
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function';
}

function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error('Unable to open image IndexedDB store.'));
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

async function idbPut(record: StoredImage): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openImageDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onerror = () => reject(req.error ?? new Error('Failed to write image to IndexedDB.'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Image IndexedDB transaction failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('Image IndexedDB transaction aborted.'));
    });
  } finally {
    db.close();
  }
}

async function idbGet(id: string): Promise<StoredImage | null> {
  if (!hasIndexedDb()) return null;
  const db = await openImageDb();
  try {
    return await new Promise<StoredImage | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as StoredImage | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('Failed to read image from IndexedDB.'));
    });
  } finally {
    db.close();
  }
}

async function idbGetAll(): Promise<StoredImage[]> {
  if (!hasIndexedDb()) return [];
  const db = await openImageDb();
  try {
    return await new Promise<StoredImage[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as StoredImage[] | undefined) ?? []);
      req.onerror = () => reject(req.error ?? new Error('Failed to list images from IndexedDB.'));
    });
  } finally {
    db.close();
  }
}

async function idbDelete(id: string): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openImageDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onerror = () => reject(req.error ?? new Error('Failed to delete image from IndexedDB.'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to commit image deletion.'));
    });
  } finally {
    db.close();
  }
}

function generateImageId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `img_${Date.now().toString(36)}_${rand}`;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Could not read image data as a Data URL.'));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed reading image file.'));
      reader.readAsDataURL(blob);
    });
  }

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const mime = blob.type || 'image/png';
  return `data:${mime};base64,${btoa(binary)}`;
}

export function computeScaledDimensions(
  width: number,
  height: number,
  maxEdge = MAX_IMAGE_EDGE_PX,
): { width: number; height: number; resized: boolean } {
  if (width <= 0 || height <= 0) {
    return { width, height, resized: false };
  }
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) {
    return { width, height, resized: false };
  }
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: true,
  };
}

async function maybeResizeImageDataUrl(
  dataUrl: string,
  mimeType: string,
): Promise<{ dataUrl: string; mimeType: string; width?: number; height?: number }> {
  // SVG stays sharp at any size; don't rasterize vectors.
  if (mimeType === 'image/svg+xml' || typeof document === 'undefined' || typeof Image === 'undefined') {
    return { dataUrl, mimeType };
  }

  // Test if canvas 2D is implemented in this environment (jsdom returns null).
  let probeCanvas: HTMLCanvasElement;
  let probeCtx: CanvasRenderingContext2D | null = null;
  try {
    probeCanvas = document.createElement('canvas');
    probeCtx = probeCanvas.getContext('2d');
  } catch {
    probeCtx = null;
  }
  if (!probeCtx) {
    return { dataUrl, mimeType };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => {
      resolve({ dataUrl, mimeType });
    }, 1000);

    img.onload = () => {
      window.clearTimeout(timer);
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;
      if (!naturalW || !naturalH) {
        resolve({ dataUrl, mimeType });
        return;
      }
      const target = computeScaledDimensions(naturalW, naturalH, MAX_IMAGE_EDGE_PX);
      if (!target.resized) {
        resolve({ dataUrl, mimeType, width: naturalW, height: naturalH });
        return;
      }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = target.width;
        canvas.height = target.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl, mimeType, width: naturalW, height: naturalH });
          return;
        }
        ctx.drawImage(img, 0, 0, target.width, target.height);
        const outputMime = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
        const resizedUrl = canvas.toDataURL(outputMime, 0.9);
        resolve({
          dataUrl: resizedUrl,
          mimeType: outputMime,
          width: target.width,
          height: target.height,
        });
      } catch {
        resolve({ dataUrl, mimeType, width: naturalW, height: naturalH });
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve({ dataUrl, mimeType });
    };

    img.src = dataUrl;
  });
}

export function registerImageSync(record: StoredImage): StoredImage {
  memoryImages.set(record.id, record);
  if (hasIndexedDb()) {
    void idbPut(record).catch(() => {
      // Background sync for seed images; explicit saves throw in saveImageDataUrl/saveImageFile.
    });
  }
  notifyListeners();
  return record;
}

export async function saveImageDataUrl(
  dataUrl: string,
  options: { id?: string; storyId?: string; name?: string; mimeType?: string; width?: number; height?: number } = {},
): Promise<StoredImage> {
  if (injectedWriteError) {
    throw new Error(injectedWriteError);
  }
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('Cannot save empty image data.');
  }

  const mimeMatch = dataUrl.match(/^data:([^;,]+)/);
  const mimeType = options.mimeType ?? mimeMatch?.[1] ?? 'image/png';
  const record: StoredImage = {
    id: options.id ?? generateImageId(),
    storyId: options.storyId,
    name: options.name ?? 'Uploaded image',
    mimeType,
    dataUrl,
    width: options.width,
    height: options.height,
    createdAt: Date.now(),
  };

  await idbPut(record);
  memoryImages.set(record.id, record);
  notifyListeners();
  return record;
}

export async function saveImageFile(
  file: Blob,
  options: { id?: string; storyId?: string; name?: string } = {},
): Promise<StoredImage> {
  if (injectedWriteError) {
    throw new Error(injectedWriteError);
  }
  if (!file || file.size === 0) {
    throw new Error('The selected image file is empty.');
  }
  const fileName = options.name ?? ('name' in file && typeof file.name === 'string' ? file.name : 'image');
  const mimeType = file.type || 'image/png';
  if (!mimeType.startsWith('image/') && mimeType !== 'application/octet-stream') {
    throw new Error(`Unsupported file type "${mimeType}". Please choose an image file.`);
  }

  const rawDataUrl = await blobToDataUrl(file);
  const processed = await maybeResizeImageDataUrl(rawDataUrl, mimeType);
  return saveImageDataUrl(processed.dataUrl, {
    id: options.id,
    storyId: options.storyId,
    name: fileName,
    mimeType: processed.mimeType,
    width: processed.width,
    height: processed.height,
  });
}

export function getImageSync(id: string | undefined): StoredImage | null {
  if (!id) return null;
  return memoryImages.get(id) ?? null;
}

export async function getImage(id: string | undefined): Promise<StoredImage | null> {
  if (!id) return null;
  const cached = memoryImages.get(id);
  if (cached) return cached;
  const fromDb = await idbGet(id);
  if (fromDb) {
    memoryImages.set(fromDb.id, fromDb);
  }
  return fromDb;
}

export async function listImages(storyId?: string): Promise<StoredImage[]> {
  const fromDb = await idbGetAll();
  for (const item of fromDb) {
    if (!memoryImages.has(item.id)) {
      memoryImages.set(item.id, item);
    }
  }
  const all = Array.from(memoryImages.values());
  const filtered = storyId
    ? all.filter((img) => !img.storyId || img.storyId === storyId)
    : all;
  return filtered.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteImage(
  id: string,
  story?: Story,
): Promise<{ ok: true } | { ok: false; usedBy: ImageUsageRef[] }> {
  if (story) {
    const usedBy = findImageUsages(story, id);
    if (usedBy.length > 0) {
      return { ok: false, usedBy };
    }
  }
  memoryImages.delete(id);
  await idbDelete(id);
  notifyListeners();
  return { ok: true };
}

export async function deleteImagesForStory(storyId: string): Promise<void> {
  const all = await listImages(storyId);
  for (const img of all) {
    if (img.storyId === storyId) {
      memoryImages.delete(img.id);
      await idbDelete(img.id);
    }
  }
  notifyListeners();
}
