import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { StorageWriteError, writeUpload } from '../../src/lib/storage/writeUpload';

let tmp: string | null = null;

afterEach(() => {
  if (tmp) {
    fs.rmSync(tmp, { recursive: true, force: true });
    tmp = null;
  }
});

function dir(): string {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-write-'));
  return tmp;
}

describe('writeUpload (§4.3 disk-before-DB contract)', () => {
  it('writes byte-identical content and leaves no .part file', async () => {
    const d = dir();
    const finalPath = path.join(d, 'a', 'b', 'f.webp');
    const data = Buffer.from('webp-content-bytes');
    await writeUpload(finalPath, data);
    expect(fs.readFileSync(finalPath).equals(data)).toBe(true);
    expect(fs.existsSync(`${finalPath}.part`)).toBe(false);
  });

  it('accepts a Node ReadableStream source', async () => {
    const d = dir();
    const finalPath = path.join(d, 'f.webp');
    const data = Buffer.from('streamed');
    await writeUpload(finalPath, Readable.from(data));
    expect(fs.readFileSync(finalPath).toString()).toBe('streamed');
  });

  it('a mid-write failure leaves no file at the final path and cleans the temp file', async () => {
    const d = dir();
    const finalPath = path.join(d, 'f.webp');
    const bad = new Readable({
      read() {
        this.push(Buffer.from('partial'));
        this.destroy(new Error('disk full'));
      },
    });
    await expect(writeUpload(finalPath, bad)).rejects.toBeInstanceOf(StorageWriteError);
    expect(fs.existsSync(finalPath)).toBe(false);
    expect(fs.existsSync(`${finalPath}.part`)).toBe(false);
  });
});
