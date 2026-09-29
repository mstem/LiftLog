import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SQLiteDatabase } from 'expo-sqlite';
import { getBackupBytes } from '@/store/settings/util';

const sqlite = vi.hoisted(() => ({
  openDatabaseAsync: vi.fn(),
  backupDatabaseAsync: vi.fn(),
}));
vi.mock('expo-sqlite', () => sqlite);

function fakeMemoryDb() {
  return {
    execAsync: vi.fn().mockResolvedValue(undefined),
    serializeAsync: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    closeAsync: vi.fn().mockResolvedValue(undefined),
  };
}

describe('getBackupBytes', () => {
  const source = {} as SQLiteDatabase;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies into a private in-memory database, not the shared cached one', async () => {
    const memoryDb = fakeMemoryDb();
    sqlite.openDatabaseAsync.mockResolvedValue(memoryDb);
    sqlite.backupDatabaseAsync.mockResolvedValue(undefined);

    await getBackupBytes({ includeFeed: true, expoDb: source });

    // expo-sqlite hands back an already-open database with the same name, so
    // without a new connection two overlapping backups share one ':memory:'
    // copy and the native backup call fails.
    expect(sqlite.openDatabaseAsync).toHaveBeenCalledWith(':memory:', {
      useNewConnection: true,
    });
    expect(memoryDb.closeAsync).toHaveBeenCalledOnce();
  });

  it('closes the in-memory copy when the backup fails', async () => {
    const memoryDb = fakeMemoryDb();
    sqlite.openDatabaseAsync.mockResolvedValue(memoryDb);
    sqlite.backupDatabaseAsync.mockRejectedValue(new Error('backup failed'));

    await expect(
      getBackupBytes({ includeFeed: true, expoDb: source }),
    ).rejects.toThrow('backup failed');
    expect(memoryDb.closeAsync).toHaveBeenCalledOnce();
  });
});
