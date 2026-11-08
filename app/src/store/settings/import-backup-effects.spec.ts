import {
  beginFeedImport,
  importBackupData,
  importData,
  importDataProto,
  importDataSql,
} from '@/store/settings';
import { addImportBackupEffects } from '@/store/settings/import-backup-effects';
import { createAddEffectTestBed } from '@/utils/__test__/add-effect-testbed';
import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'path';
import { gunzipSync, gzipSync } from 'zlib';
import { deserializeDatabaseAsync } from 'expo-sqlite';
import { FeedBackupData } from '@/models/backup';
import { FeedIdentity } from '@/models/feed-models';
import { ProgramBlueprint } from '@/models/blueprint-models';
import { EmptySession, Session } from '@/models/session-models';
import { uuid } from '@/utils/uuid';
import {
  checkIfWeightMigrationRequired,
  upsertStoredSessions,
} from '@/store/stored-sessions';
import { upsertSavedPlans } from '@/store/program';
import { showSnackbar } from '@/store/app';
import { restoreInjuryState } from '@/store/injury';
import { emptyInjuryState, InjuryState } from '@/models/injury/injury';

describe('import-backup-effects', () => {
  it('dispatches a valid import when the sqlite db is there', async () => {
    const realBytes = await readFile(
      resolve(__dirname, '../../utils/__test__/export.liftlogbackup.sqlite.gz'),
    );
    const testBed = createAddEffectTestBed({
      services: {
        filePickerService: {
          pickFile: vi.fn().mockResolvedValue({ bytes: realBytes }),
        },
        tolgee: { t: (s: string) => s },
      },
    });

    addImportBackupEffects(testBed.addEffect);
    await testBed.dispatchHandled(importData());
    const importDataSqlAction = testBed.getDispatchedAction(importDataSql);

    await testBed.dispatchHandled(importDataSqlAction);

    const dispatchedImport = testBed.getDispatchedAction(importBackupData);
    expect(dispatchedImport.payload.workouts).toHaveLength(420);
    expect(dispatchedImport.payload.feed).toBeDefined();
    expect(Object.values(dispatchedImport.payload.programs)).toHaveLength(13);
    // Made before injury settings were included in backups.
    expect(dispatchedImport.payload.injury).toBeUndefined();
  });

  it('dispatches a valid import when it is a proto', async () => {
    const realBytes = await readFile(
      resolve(
        __dirname,
        '../../utils/__test__/export.liftlogbackup.protobuf.gz',
      ),
    );
    const testBed = createAddEffectTestBed({
      services: {
        filePickerService: {
          pickFile: vi.fn().mockResolvedValue({ bytes: realBytes }),
        },
        tolgee: { t: (s: string) => s },
      },
    });

    addImportBackupEffects(testBed.addEffect);
    await testBed.dispatchHandled(importData());
    const importDataSqlAction = testBed.getDispatchedAction(importDataProto);

    await testBed.dispatchHandled(importDataSqlAction);

    const dispatchedImport = testBed.getDispatchedAction(importBackupData);
    expect(dispatchedImport.payload.workouts).toHaveLength(85);
    expect(dispatchedImport.payload.feed).toBeUndefined();
    expect(Object.values(dispatchedImport.payload.programs)).toHaveLength(0);
  });
  it('dispatches the appropriate actions when importing', async () => {
    const testBed = createAddEffectTestBed({
      services: {
        tolgee: { t: (s: string) => s },
      },
    });
    addImportBackupEffects(testBed.addEffect);

    const mockWorkouts = [
      EmptySession,
      EmptySession.with({ id: uuid() }),
    ] as Session[];
    const mockPrograms = {} as Record<string, ProgramBlueprint>;
    const mockFeed: FeedBackupData = {
      identity: {} as FeedIdentity,
      feedItems: [],
      followRequests: [],
      followed: [],
      followers: [],
    };

    await testBed.dispatchHandled(
      importBackupData({
        workouts: mockWorkouts,
        programs: mockPrograms,
        feed: mockFeed,
      }),
    );

    expect(testBed.getDispatchedAction(upsertStoredSessions).payload).toBe(
      mockWorkouts,
    );
    expect(testBed.getDispatchedAction(upsertSavedPlans).payload).toBe(
      mockPrograms,
    );
    expect(testBed.getDispatchedAction(showSnackbar).payload.text).toBe(
      'Restore complete!',
    );
    expect(
      testBed.getDispatchedAction(checkIfWeightMigrationRequired),
    ).toBeDefined();
    expect(testBed.getDispatchedAction(beginFeedImport).payload).toBe(mockFeed);
  });

  it('does not dispatch beginFeedImport when feed is absent', async () => {
    const testBed = createAddEffectTestBed({
      services: {
        tolgee: { t: (s: string) => s },
      },
    });
    addImportBackupEffects(testBed.addEffect);

    await testBed.dispatchHandled(
      importBackupData({
        workouts: [],
        programs: {},
        feed: undefined,
      }),
    );

    testBed.expectNotDispatched(beginFeedImport);
  });

  it('restores the injury settings carried in a backup', async () => {
    const testBed = createAddEffectTestBed({
      services: {
        tolgee: { t: (s: string) => s },
      },
    });
    addImportBackupEffects(testBed.addEffect);
    const injury: InjuryState = {
      ...emptyInjuryState,
      flagOverrides: { dip: true },
    };

    await testBed.dispatchHandled(
      importBackupData({ workouts: [], programs: {}, injury }),
    );

    expect(testBed.getDispatchedAction(restoreInjuryState).payload).toBe(
      injury,
    );
  });

  it('leaves injury settings alone when the backup has none', async () => {
    const testBed = createAddEffectTestBed({
      services: {
        tolgee: { t: (s: string) => s },
      },
    });
    addImportBackupEffects(testBed.addEffect);

    await testBed.dispatchHandled(
      importBackupData({ workouts: [], programs: {} }),
    );

    testBed.expectNotDispatched(restoreInjuryState);
  });

  it('ignores an unreadable injury entry in a sqlite backup', async () => {
    const fixture = await readFile(
      resolve(__dirname, '../../utils/__test__/export.liftlogbackup.sqlite.gz'),
    );
    const db = await deserializeDatabaseAsync(gunzipSync(fixture));
    await db.execAsync(
      'CREATE TABLE injury_state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)',
    );
    await db.runAsync(
      'INSERT INTO injury_state (id, payload) VALUES (1, ?)',
      '{"injury": {"onsetDa',
    );
    const bytes = gzipSync(await db.serializeAsync());
    await db.closeAsync();
    const testBed = createAddEffectTestBed({
      services: {
        filePickerService: {
          pickFile: vi.fn().mockResolvedValue({ bytes }),
        },
        tolgee: { t: (s: string) => s },
      },
    });
    addImportBackupEffects(testBed.addEffect);

    await testBed.dispatchHandled(importData());
    await testBed.dispatchHandled(testBed.getDispatchedAction(importDataSql));

    const dispatchedImport = testBed.getDispatchedAction(importBackupData);
    expect(dispatchedImport.payload.injury).toBeUndefined();
  });

  it('reads the injury settings out of a sqlite backup', async () => {
    const fixture = await readFile(
      resolve(__dirname, '../../utils/__test__/export.liftlogbackup.sqlite.gz'),
    );
    const db = await deserializeDatabaseAsync(gunzipSync(fixture));
    await db.execAsync(
      'CREATE TABLE injury_state (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)',
    );
    await db.runAsync(
      'INSERT INTO injury_state (id, payload) VALUES (1, ?)',
      JSON.stringify({ flagOverrides: { dip: true }, nextDayAnswers: {} }),
    );
    const bytes = gzipSync(await db.serializeAsync());
    await db.closeAsync();
    const testBed = createAddEffectTestBed({
      services: {
        filePickerService: {
          pickFile: vi.fn().mockResolvedValue({ bytes }),
        },
        tolgee: { t: (s: string) => s },
      },
    });
    addImportBackupEffects(testBed.addEffect);

    await testBed.dispatchHandled(importData());
    await testBed.dispatchHandled(testBed.getDispatchedAction(importDataSql));

    const dispatchedImport = testBed.getDispatchedAction(importBackupData);
    expect(dispatchedImport.payload.injury?.flagOverrides).toEqual({
      dip: true,
    });
  });
});
