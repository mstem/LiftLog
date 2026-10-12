import { describe, it, expect } from 'vitest';
import { screenOutcome, ScreenAnswers } from '@/models/injury/screen';

const clear: ScreenAnswers = {
  traumaWithWeakness: false,
  feverOrHotJoint: false,
  painfulArc: false,
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
    { dropArm: true, painfulArc: true },
    { neckSymptoms: true },
  ])('%o sends to a physio first', (a) => {
    expect(screenOutcome({ ...clear, ...a }).kind).toBe('physio');
  });

  it('drop arm alone is not enough for physio routing', () => {
    expect(screenOutcome({ ...clear, dropArm: true }).kind).toBe('ok');
  });

  it('suggests structures', () => {
    expect(
      screenOutcome({ ...clear, painfulArc: true, scapularSymptoms: true }),
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

  it('unanswered checks count as no', () => {
    expect(
      screenOutcome({ ...clear, painfulArc: undefined, dropArm: undefined })
        .kind,
    ).toBe('ok');
  });
});
