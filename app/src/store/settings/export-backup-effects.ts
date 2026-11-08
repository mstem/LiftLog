import { AddEffectFn } from '@/store/store';
import { exportData } from '@/store/settings';
import 'compression-streams-polyfill';
import { DateTimeFormatter, LocalDateTime } from '@js-joda/core';
import { getBackupBytes } from '@/store/settings/util';
import { serializeInjuryState } from '@/models/injury/injury';

export function addExportBackupEffects(addEffect: AddEffectFn) {
  addEffect(
    exportData,
    async (
      { payload: { includeFeed } },
      { getState, extra: { fileExportService, expoDb } },
    ) => {
      const injury = getState().injury;
      const now = LocalDateTime.now()
        .withNano(0)
        .format(DateTimeFormatter.ISO_LOCAL_DATE_TIME)
        .replaceAll(':', '')
        .replaceAll('T', '_')
        .replaceAll('-', '');
      await fileExportService.exportBytes(
        `export.liftlogbackup.${now}.sqlite.gz`,
        await getBackupBytes({
          includeFeed,
          expoDb,
          injuryState: injury.isHydrated
            ? serializeInjuryState(injury)
            : undefined,
        }),
        'application/octet-stream',
      );
    },
  );
}
