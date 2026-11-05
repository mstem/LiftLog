import { requireOptionalNativeModule } from 'expo';

interface NativeTrainerWidget {
  setConfig(url: string | null, apiKey: string | null): void;
  refresh(): void;
}

// Android only: the home-screen widget. Elsewhere the module is absent and
// these calls do nothing.
const native = requireOptionalNativeModule<NativeTrainerWidget>('TrainerWidget');

export default {
  setConfig(url: string | null, apiKey: string | null): void {
    native?.setConfig(url, apiKey);
  },
  refresh(): void {
    native?.refresh();
  },
};
