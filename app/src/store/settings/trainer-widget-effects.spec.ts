import { describe, expect, it, vi } from 'vitest';
import {
  remoteBackupSucceeded,
  setRemoteBackupSettings,
} from '@/store/settings';
import { addTrainerWidgetEffects } from '@/store/settings/trainer-widget-effects';
import { createAddEffectTestBed } from '@/utils/__test__/add-effect-testbed';

function bed() {
  const trainerWidgetService = { setConfig: vi.fn(), refresh: vi.fn() };
  const testBed = createAddEffectTestBed({
    services: { trainerWidgetService },
  });
  addTrainerWidgetEffects(testBed.addEffect);
  return { testBed, trainerWidgetService };
}

describe('addTrainerWidgetEffects', () => {
  it('hands the widget the origin plus /widget and the key', async () => {
    const { testBed, trainerWidgetService } = bed();
    await testBed.dispatchHandled(
      setRemoteBackupSettings({
        endpoint: 'https://lifts.mindshine.io/',
        apiKey: ' k ',
        includeFeedAccount: false,
      }),
    );
    expect(trainerWidgetService.setConfig).toHaveBeenCalledWith(
      'https://lifts.mindshine.io/widget',
      'k',
    );
  });

  it('clears the config when the endpoint is removed', async () => {
    const { testBed, trainerWidgetService } = bed();
    await testBed.dispatchHandled(
      setRemoteBackupSettings({
        endpoint: '',
        apiKey: '',
        includeFeedAccount: false,
      }),
    );
    expect(trainerWidgetService.setConfig).toHaveBeenCalledWith(null, null);
  });

  it('refreshes after a backup lands', async () => {
    const { testBed, trainerWidgetService } = bed();
    await testBed.dispatchHandled(remoteBackupSucceeded());
    expect(trainerWidgetService.refresh).toHaveBeenCalledOnce();
  });
});
