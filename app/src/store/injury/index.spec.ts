import { describe, it, expect } from 'vitest';
import {
  injuryReducer,
  setInjury,
  resolveInjury,
  setFlagOverride,
  answerNextDay,
} from '@/store/injury';
import {
  emptyInjuryState,
  parseInjuryState,
  serializeInjuryState,
  Injury,
  injuryEraStart,
} from '@/models/injury/injury';
import { OffsetDateTime } from '@js-joda/core';

const cuff: Injury = {
  slug: 'shoulder',
  name: 'Shoulder',
  side: 'left',
  structures: ['supraspinatus'],
  onsetDate: '2026-04-25',
  painLimit: 5,
  firstCut: 0.5,
  status: 'active',
  screenFindings: undefined,
  trackedFrom: '2026-05-11T09:00:00Z',
};

describe('injury slice', () => {
  it('sets and resolves an injury', () => {
    let s = injuryReducer(emptyInjuryState, setInjury(cuff));
    expect(s.injury?.status).toBe('active');
    s = injuryReducer(s, resolveInjury());
    expect(s.injury?.status).toBe('resolved');
  });

  it('removes an override when set to undefined', () => {
    let s = injuryReducer(
      emptyInjuryState,
      setFlagOverride({ name: 'dips', flagged: false }),
    );
    expect(s.flagOverrides).toEqual({ dips: false });
    s = injuryReducer(s, setFlagOverride({ name: 'dips', flagged: undefined }));
    expect(s.flagOverrides).toEqual({});
  });

  it('records next-day answers by session', () => {
    const s = injuryReducer(
      emptyInjuryState,
      answerNextDay({ sessionId: 'a', answer: 'worse' }),
    );
    expect(s.nextDayAnswers).toEqual({ a: 'worse' });
  });
});

describe('injury persistence', () => {
  it('round-trips', () => {
    const state = { ...emptyInjuryState, isHydrated: true, injury: cuff };
    expect(parseInjuryState(serializeInjuryState(state))).toEqual(state);
  });

  it('fills defaults for an injury saved without newer fields', () => {
    const parsed = parseInjuryState(
      JSON.stringify({
        injury: { slug: 'x', name: 'X', side: 'left', onsetDate: '2026-04-25' },
      }),
    );
    expect(parsed.injury).toMatchObject({
      painLimit: 5,
      firstCut: 0.5,
      structures: [],
      status: 'active',
    });
    expect(parsed.flagOverrides).toEqual({});
  });

  it('backfills trackedFrom as the start of the onset day', () => {
    const parsed = parseInjuryState(
      JSON.stringify({
        injury: { slug: 'x', name: 'X', side: 'left', onsetDate: '2026-04-25' },
      }),
    );
    const start = OffsetDateTime.parse(parsed.injury!.trackedFrom);
    expect(start.toLocalDate().toString()).toBe('2026-04-25');
    expect(start.toLocalTime().toString()).toBe('00:00');
    expect(injuryEraStart(parsed.injury!).equals(start)).toBe(true);
  });

  it('treats missing or corrupt storage as no injury', () => {
    expect(parseInjuryState(undefined).injury).toBeUndefined();
    expect(parseInjuryState('{not json').injury).toBeUndefined();
  });
});
