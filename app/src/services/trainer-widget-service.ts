import TrainerWidget from '~/modules/trainer-widget';

/**
 * The Android home-screen widget that shows the trainer's next session and
 * the week's totals. It fetches its file from the same host the remote backup
 * goes to, so the app only has to hand over that endpoint and key.
 */
export interface TrainerWidgetService {
  setConfig(url: string | null, apiKey: string | null): void;
  refresh(): void;
}

export class NativeTrainerWidgetService implements TrainerWidgetService {
  setConfig(url: string | null, apiKey: string | null): void {
    TrainerWidget.setConfig(url, apiKey);
  }

  refresh(): void {
    TrainerWidget.refresh();
  }
}
