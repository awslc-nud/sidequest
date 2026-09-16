import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';

export class StorageWriteError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'StorageWriteError';
  }
}

export type WriteSource = NodeJS.ReadableStream | ReadableStream | Buffer | Uint8Array;

function toNodeStream(source: WriteSource): NodeJS.ReadableStream {
  if (source instanceof Readable) return source;
  if (Buffer.isBuffer(source)) return Readable.from(source);
  if (source instanceof Uint8Array) return Readable.from(Buffer.from(source));
  // Web ReadableStream (e.g. a multipart File/Blob stream)
  return Readable.fromWeb(source as unknown as NodeWebReadableStream);
}

/** Recursively ensure a directory exists. */
export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

/**
 * Append-only write to `finalPath` via a temp sibling file + atomic rename,
 * per §4.3 (disk-then-DB ordering contract). On any failure the temp file is
 * removed and no partial file is ever left at `finalPath`.
 */
export async function writeUpload(finalPath: string, source: WriteSource): Promise<void> {
  const tmpPath = `${finalPath}.part`;
  await ensureDir(path.dirname(finalPath));
  try {
    await pipeline(toNodeStream(source), fs.createWriteStream(tmpPath, { flags: 'w' }));
    await fsp.rename(tmpPath, finalPath);
  } catch (e) {
    await fsp.unlink(tmpPath).catch(() => undefined);
    throw new StorageWriteError(`Failed to write upload to ${finalPath}`, e);
  }
}
