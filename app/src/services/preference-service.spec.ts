import { describe, expect, it, vi } from 'vitest';
import { PreferenceService } from '@/services/preference-service';
import { KeyValueStore } from '@/services/key-value-store';

function store(values: Record<string, string>) {
  const removeItem = vi.fn(async (key: string) => {
    delete values[key];
  });
  const kv = {
    getItem: async (key: string) => values[key],
    removeItem,
  } as unknown as KeyValueStore;
  return { kv, removeItem, values };
}

describe('getSkiPrepUntil', () => {
  it('returns a stored ISO date', async () => {
    const { kv } = store({ skiPrepUntil: '2027-01-03' });
    expect(await new PreferenceService(kv).getSkiPrepUntil()).toBe(
      '2027-01-03',
    );
  });

  it('drops and clears a malformed stored date', async () => {
    const { kv, values } = store({ skiPrepUntil: '2027-1-3' });
    expect(await new PreferenceService(kv).getSkiPrepUntil()).toBeUndefined();
    expect(values.skiPrepUntil).toBeUndefined();
  });

  it('still loads when clearing the malformed date fails', async () => {
    const { kv, removeItem } = store({ skiPrepUntil: 'garbage' });
    removeItem.mockRejectedValueOnce(new Error('disk'));
    expect(await new PreferenceService(kv).getSkiPrepUntil()).toBeUndefined();
  });
});
