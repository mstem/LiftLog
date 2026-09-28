const { withMainApplication } = require('@expo/config-plugins');

/*
  Turns off React Native's enableCustomFocusSearchOnClippedElementsAndroid flag.

  With it on, Android asks Fabric for the next focusable element whenever a
  TextInput regains an input connection. That lookup walks the shadow tree
  registry and can read a tree that is mid-update, which segfaults the whole
  app (SIGSEGV in FabricUIManagerBinding::findNextFocusableElement). It fired
  when saving a mid-workout exercise edit while a rest timer was re-rendering
  the session. Upstream: https://github.com/react/react-native/issues/57951,
  whose suggested workaround is exactly this flag.

  loadReactNative() installs the stable flag set, and a second override() throws,
  so this replaces it afterwards with the same set plus the one change.
*/

const IMPORTS = [
  'import com.facebook.react.internal.featureflags.ReactNativeFeatureFlags',
  'import com.facebook.react.internal.featureflags.ReactNativeNewArchitectureFeatureFlagsDefaults',
];

const OVERRIDE = `
    // Added by plugins/disable-clipped-focus-search.js
    ReactNativeFeatureFlags.dangerouslyForceOverride(
      object : ReactNativeNewArchitectureFeatureFlagsDefaults() {
        override fun useFabricInterop(): Boolean = true
        override fun enableCustomFocusSearchOnClippedElementsAndroid(): Boolean = false
      }
    )`;

function addClippedFocusSearchOverride(source) {
  if (source.includes('enableCustomFocusSearchOnClippedElementsAndroid')) {
    return source;
  }
  if (!source.includes('loadReactNative(this)')) {
    throw new Error(
      'disable-clipped-focus-search: loadReactNative(this) not found in MainApplication',
    );
  }
  let result = source.replace(
    /^(import com\.facebook\.react\.ReactHost)$/m,
    `$1\n${IMPORTS.join('\n')}`,
  );
  result = result.replace('loadReactNative(this)', `loadReactNative(this)${OVERRIDE}`);
  return result;
}

function withDisabledClippedFocusSearch(config) {
  return withMainApplication(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('disable-clipped-focus-search: expected a Kotlin MainApplication');
    }
    config.modResults.contents = addClippedFocusSearchOverride(
      config.modResults.contents,
    );
    return config;
  });
}

module.exports = withDisabledClippedFocusSearch;
module.exports.addClippedFocusSearchOverride = addClippedFocusSearchOverride;
