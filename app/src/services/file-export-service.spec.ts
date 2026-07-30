import { beforeEach, describe, expect, it, vi } from 'vitest';

const platform = { OS: 'android' as 'android' | 'ios' };
const saf = {
  requestDirectoryPermissionsAsync: vi.fn(),
  createFileAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
};
const shareAsync = vi.fn();

vi.mock('react-native', () => ({ Platform: platform }));
vi.mock('expo-sharing', () => ({ shareAsync }));
vi.mock('expo-file-system/legacy', () => ({ StorageAccessFramework: saf }));
vi.mock('expo-file-system', () => {
  class File {
    exists = false;
    uri = 'file:///cache/export';
    constructor(public path: string) {}
    create() {}
    delete() {}
    writableStream() {
      return {
        getWriter: () => ({
          write: () => Promise.resolve(),
          close: () => Promise.resolve(),
        }),
      };
    }
  }
  return {
    File,
    Paths: { cache: '/cache', join: (...parts: string[]) => parts.join('/') },
  };
});

const { FileExportService } = await import('@/services/file-export-service');

const BYTES = new Uint8Array([1, 2, 3]);

describe('FileExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platform.OS = 'android';
    saf.requestDirectoryPermissionsAsync.mockResolvedValue({
      granted: true,
      directoryUri: 'content://tree/primary',
    });
    saf.createFileAsync.mockResolvedValue('content://tree/primary/doc/file');
    saf.writeAsStringAsync.mockResolvedValue(undefined);
  });

  it('writes to the chosen folder on android without also opening the share sheet', async () => {
    await new FileExportService().exportBytes(
      'backup.sqlite.gz',
      BYTES,
      'app/x',
    );

    expect(saf.createFileAsync).toHaveBeenCalledWith(
      'content://tree/primary',
      'backup.sqlite.gz',
      'app/x',
    );
    expect(saf.writeAsStringAsync).toHaveBeenCalledOnce();
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it('treats a dismissed folder picker as a cancelled export, not a share', async () => {
    saf.requestDirectoryPermissionsAsync.mockResolvedValue({ granted: false });

    await new FileExportService().exportBytes(
      'backup.sqlite.gz',
      BYTES,
      'app/x',
    );

    expect(saf.createFileAsync).not.toHaveBeenCalled();
    // Falling back to the share sheet here made a single export prompt twice.
    expect(shareAsync).not.toHaveBeenCalled();
  });

  it('uses the share sheet off android', async () => {
    platform.OS = 'ios';

    await new FileExportService().exportBytes(
      'backup.sqlite.gz',
      BYTES,
      'app/x',
    );

    expect(saf.requestDirectoryPermissionsAsync).not.toHaveBeenCalled();
    expect(shareAsync).toHaveBeenCalledOnce();
  });
});
