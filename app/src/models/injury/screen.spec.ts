import { describe, it, expect } from 'vitest';
import { screenOutcome, ScreenAnswers } from '@/models/injury/screen';

const clear: ScreenAnswers = {
  traumaWithWeakness: false,
  feverOrHotJoint: false,
  arcPain: 'none',
  dropArm: false,
  passiveAsLimitedAsActive: false,
  neckSymptoms: false,
  scapularSymptoms: false,
};

describe('screenOutcome', () => {
  it.each(['traumaWithWeakness', 'feverOrHotJoint'] as const)(
    '%s sends to a clinician',
    (flag) => {
      expect(screenOutcome({ ...clear, [flag]: true }).kind).toBe('clinician');
    },
  );

  it.each([
    { passiveAsLimitedAsActive: true },
    { dropArm: true, arcPain: 'middle' as const },
    { arcPain: 'whole' as const },
    { neckSymptoms: true },
  ])('%o sends to a physio first', (a) => {
    expect(screenOutcome({ ...clear, ...a }).kind).toBe('physio');
  });

  it('drop arm alone is not enough for physio routing', () => {
    expect(screenOutcome({ ...clear, dropArm: true }).kind).toBe('ok');
  });

  it('suggests structures', () => {
    expect(
      screenOutcome({ ...clear, arcPain: 'middle', scapularSymptoms: true }),
    ).toEqual({
      kind: 'ok',
      suggestedStructures: [
        'supraspinatus',
        'serratus anterior',
        'lower trapezius',
        'middle trapezius',
        'rhomboids',
      ],
    });
  });

  it('pain near the top suggests the AC joint and shoulder blade rotators', () => {
    expect(screenOutcome({ ...clear, arcPain: 'top' })).toEqual({
      kind: 'ok',
      suggestedStructures: ['AC joint', 'serratus anterior', 'lower trapezius'],
    });
  });

  it('lists a structure once when two answers suggest it', () => {
    expect(
      screenOutcome({ ...clear, arcPain: 'top', scapularSymptoms: true }),
    ).toEqual({
      kind: 'ok',
      suggestedStructures: [
        'AC joint',
        'serratus anterior',
        'lower trapezius',
        'middle trapezius',
        'rhomboids',
      ],
    });
  });

  it('drop arm with pain near the top is not physio routing', () => {
    expect(
      screenOutcome({ ...clear, dropArm: true, arcPain: 'top' }).kind,
    ).toBe('ok');
  });

  it('unanswered checks count as no', () => {
    expect(
      screenOutcome({ ...clear, arcPain: undefined, dropArm: undefined }).kind,
    ).toBe('ok');
  });
});
