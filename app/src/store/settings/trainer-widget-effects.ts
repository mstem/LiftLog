import { AddEffectFn } from '@/store/store';
import {
  remoteBackupSucceeded,
  setRemoteBackupSettings,
} from '@/store/settings';
import { trainerWidgetUrl } from '@/utils/trainer-widget-url';

/**
 * Keeps the home-screen widget pointed at the remote backup host. The settings
 * action also fires at hydration, so startup is covered; a backup landing is
 * the moment the trainer's numbers change, so the widget refreshes then.
 */
export function addTrainerWidgetEffects(addEffect: AddEffectFn) {
  addEffect(
    setRemoteBackupSettings,
    async (action, { extra: { trainerWidgetService } }) => {
      const url = trainerWidgetUrl(action.payload.endpoint);
      const apiKey = action.payload.apiKey?.trim() || null;
      trainerWidgetService.setConfig(url, url ? apiKey : null);
    },
  );
  addEffect(remoteBackupSucceeded, async (_, { extra: { trainerWidgetService } }) => {
    trainerWidgetService.refresh();
  });
}
