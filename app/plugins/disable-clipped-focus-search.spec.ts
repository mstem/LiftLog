import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addClippedFocusSearchOverride } = require('./disable-clipped-focus-search');

const mainApplication = `package com.limajuice.liftlog

import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactHost

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }
}
`;

describe('addClippedFocusSearchOverride', () => {
  it('turns the flag off right after React Native loads', () => {
    const result: string = addClippedFocusSearchOverride(mainApplication);

    const load = result.indexOf('loadReactNative(this)');
    const override = result.indexOf('dangerouslyForceOverride');
    const lifecycle = result.indexOf('ApplicationLifecycleDispatcher');
    expect(load).toBeGreaterThan(-1);
    expect(override).toBeGreaterThan(load);
    expect(lifecycle).toBeGreaterThan(override);
    expect(result).toContain(
      'override fun enableCustomFocusSearchOnClippedElementsAndroid(): Boolean = false',
    );
  });

  it('keeps the stable flag set it replaces', () => {
    const result: string = addClippedFocusSearchOverride(mainApplication);

    expect(result).toContain('override fun useFabricInterop(): Boolean = true');
  });

  it('adds the imports the override needs', () => {
    const result: string = addClippedFocusSearchOverride(mainApplication);

    expect(result).toContain(
      'import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags\n',
    );
    expect(result).toContain(
      'import com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults\n',
    );
  });

  it('is idempotent across repeated prebuilds', () => {
    const once: string = addClippedFocusSearchOverride(mainApplication);

    expect(addClippedFocusSearchOverride(once)).toBe(once);
  });

  it('fails loudly when the entry point has changed shape', () => {
    expect(() => addClippedFocusSearchOverride('class MainApplication {}')).toThrow(
      /loadReactNative/,
    );
  });
});
