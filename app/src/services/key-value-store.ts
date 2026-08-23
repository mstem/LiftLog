import { uuid } from '@/utils/uuid';
import { File, Paths } from 'expo-file-system';

export class KeyValueStore {
  /**
   * One key, one operation at a time. A write is a create/write/delete/move
   * sequence and a remove is a delete, so two of them in flight together can
   * finish out of order - the classic result being a workout that was just
   * finished and cleared getting written back over the clear, so it returns as
   * the current session on the next launch. Queueing per key also stops a read
   * landing in the window where the final file has been deleted but the temp
   * file has not been moved into place yet.
   */
  private readonly operations = new Map<string, Promise<unknown>>();

  private enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.operations.get(key) ?? Promise.resolve();
    // Run next regardless of whether the previous operation failed.
    const result = previous.then(operation, operation);
    const settled = result.then(
      () => undefined,
      () => undefined,
    );
    this.operations.set(key, settled);
    void settled.then(() => {
      // Don't hold on to keys that are no longer being written to.
      if (this.operations.get(key) === settled) {
        this.operations.delete(key);
      }
    });
    return result;
  }

  async getItem(key: string): Promise<string | undefined> {
    return this.enqueue(key, () => this.getItemInternal(key));
  }

  async getItemBytes(key: string): Promise<Uint8Array | undefined> {
    return this.enqueue(key, () => this.getItemBytesInternal(key));
  }

  async setItem(key: string, value: string | Uint8Array): Promise<void> {
    return this.enqueue(key, () => this.setItemInternal(key, value));
  }

  async removeItem(key: string): Promise<void> {
    return this.enqueue(key, () => this.removeItemInternal(key));
  }

  private async getItemInternal(key: string): Promise<string | undefined> {
    const file = getFile(key);
    if (file.exists) {
      return file.text();
    }
    return undefined;
  }

  private async getItemBytesInternal(
    key: string,
  ): Promise<Uint8Array | undefined> {
    const file = getFile(key);
    if (file.exists) {
      return this.readBytes(file);
    }
    return undefined;
  }

  private async setItemInternal(
    key: string,
    value: string | Uint8Array,
  ): Promise<void> {
    // We do this tempfile business to catch if the app crashes halfway through a write, don't want to corrupt the existing data.
    // Originally I found that if the value was < the original file length then it kept the old files extra data -corrupting it.
    // Could just delete it, but this feels like less chance of data loss
    const tempFile = getFile(key + '-tmp' + uuid());
    const finalFile = getFile(key);
    tempFile.create();

    if (typeof value === 'string') {
      tempFile.write(value);
      if (finalFile.exists) {
        finalFile.delete();
      }
      await tempFile.move(finalFile, { overwrite: true });
      return;
    }
    const stream = tempFile.writableStream();
    const writer = stream.getWriter();
    try {
      await writer.write(value);
    } finally {
      await writer.close();
    }
    if (finalFile.exists) {
      finalFile.delete();
    }
    await tempFile.move(finalFile, { overwrite: true });
  }

  getItemSync(key: string): string | undefined {
    const file = getFile(key);
    if (file.exists) {
      return file.textSync();
    }
    return undefined;
  }

  private async removeItemInternal(key: string): Promise<void> {
    const file = getFile(key);
    if (file.exists) {
      file.delete();
    }
  }

  private async readBytes(file: File): Promise<Uint8Array> {
    const readBytes = new Uint8Array(file.size);
    let offset = 0;
    // This is probably slower than just using sync file.read, but it won't lock the UI thread...
    for await (const bytesAny of file.readableStream().values()) {
      const bytes = bytesAny as Uint8Array;
      readBytes.set(bytes, offset);
      offset += bytes.length;
    }
    return readBytes;
  }
}

function getFile(key: string): File {
  return new File(Paths.join(Paths.document, key));
}
