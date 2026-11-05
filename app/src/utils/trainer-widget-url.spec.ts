import { describe, expect, it } from 'vitest';
import { trainerWidgetUrl } from '@/utils/trainer-widget-url';

describe('trainerWidgetUrl', () => {
  it('is the origin plus /widget', () => {
    expect(trainerWidgetUrl('https://lifts.mindshine.io')).toBe(
      'https://lifts.mindshine.io/widget',
    );
    expect(trainerWidgetUrl('https://lifts.mindshine.io/')).toBe(
      'https://lifts.mindshine.io/widget',
    );
    expect(trainerWidgetUrl(' https://lifts.mindshine.io/backup?x=1 ')).toBe(
      'https://lifts.mindshine.io/widget',
    );
    expect(trainerWidgetUrl('https://host:8443/x')).toBe(
      'https://host:8443/widget',
    );
  });

  it('is null when there is no usable endpoint', () => {
    expect(trainerWidgetUrl(undefined)).toBeNull();
    expect(trainerWidgetUrl('')).toBeNull();
    expect(trainerWidgetUrl('   ')).toBeNull();
    expect(trainerWidgetUrl('not a url')).toBeNull();
    expect(trainerWidgetUrl('ftp://x')).toBeNull();
  });
});
