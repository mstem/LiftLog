import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import { LocalDate, OffsetDateTime } from '@js-joda/core';
import { injuryWeight, InjuryHistoryEntry } from '@/models/injury/load';
import {
  IncreaseAllEvenlyProgressiveOverload,
  Rest,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedSet,
  RecordedWeightedExercise,
} from '@/models/session-models';
import { Weight } from '@/models/weight';

const bp = new WeightedExerciseBlueprint(
  'Standing Military Press',
  3,
  8,
  new IncreaseAllEvenlyProgressiveOverload(BigNumber(2.5)),
  Rest.medium,
  false,
  '',
  '',
);
const kg = (n: number) => new Weight(n, 'kilograms');
const onset = LocalDate.parse('2026-04-25');
let n = 0;
function entry(
  date: string,
  weight: number,
  pains: (number | undefined)[],
  unit: Weight['unit'] = 'kilograms',
): InjuryHistoryEntry {
  return {
    sessionId: `s${n++}`,
    date: LocalDate.parse(date),
    exercise: new RecordedWeightedExercise(
      bp,
      pains.map(
        (p) =>
          new PotentialSet(
            new RecordedSet(8, OffsetDateTime.now(), p),
            new Weight(weight, unit),
          ),
      ),
      undefined,
    ),
  };
}
const base = {
  onsetDate: onset,
  carried: kg(41),
  increment: BigNumber(2.5),
  painLimit: 5,
  firstCut: 0.5,
  nextDayAnswers: {},
};

describe('injuryWeight', () => {
  it('never adds load to a lift done with no added weight', () => {
    const h = [
      entry('2026-04-30', 0, [2, 3, 3]),
      entry('2026-05-02', 0, [2, 2, 3]),
    ];
    expect(
      injuryWeight({ ...base, carried: kg(0), history: h }).value.toNumber(),
    ).toBe(0);
  });

  it('ignores sessions where nothing was ticked', () => {
    const skipped = (date: string): InjuryHistoryEntry => {
      const e = entry(date, 20, [undefined]);
      return {
        ...e,
        exercise: new RecordedWeightedExercise(
          bp,
          [new PotentialSet(undefined, kg(20))],
          undefined,
        ),
      };
    };
    const h = [
      entry('2026-04-30', 20, [2, 3, 3]),
      skipped('2026-05-02'),
      skipped('2026-05-04'),
    ];
    expect(injuryWeight({ ...base, history: h }).equals(kg(20))).toBe(true);
  });

  it('cuts the carried weight on the first injury-era session, rounding down', () => {
    expect(injuryWeight({ ...base, history: [] }).equals(kg(20))).toBe(true);
  });

  it('ignores recordings before the onset date', () => {
    const h = [entry('2026-04-20', 40, [2, 2, 2])];
    expect(injuryWeight({ ...base, history: h }).equals(kg(20))).toBe(true);
  });

  it('keeps the weight after one passing session', () => {
    const h = [entry('2026-04-30', 20, [2, 3, 3])];
    expect(injuryWeight({ ...base, history: h }).equals(kg(20))).toBe(true);
  });

  it('adds a step after two passing sessions at the same weight', () => {
    const h = [
      entry('2026-04-30', 20, [2, 3, 3]),
      entry('2026-05-02', 20, [2, 2, 3]),
    ];
    expect(injuryWeight({ ...base, history: h }).equals(kg(22.5))).toBe(true);
  });

  it('does not add again straight after a step', () => {
    const h = [
      entry('2026-04-30', 20, [2, 3, 3]),
      entry('2026-05-02', 20, [2, 2, 3]),
      entry('2026-05-04', 22.5, [2, 2, 3]),
    ];
    expect(injuryWeight({ ...base, history: h }).equals(kg(22.5))).toBe(true);
  });

  it('drops a step when a set went over the limit', () => {
    const h = [entry('2026-04-30', 20, [3, 6])];
    expect(injuryWeight({ ...base, history: h }).equals(kg(17.5))).toBe(true);
  });

  it('drops a step when the next day was worse', () => {
    const e = entry('2026-04-30', 20, [2, 2, 2]);
    expect(
      injuryWeight({
        ...base,
        history: [e],
        nextDayAnswers: { [e.sessionId]: 'worse' },
      }).equals(kg(17.5)),
    ).toBe(true);
  });

  it('counts an unanswered pain prompt as a pass', () => {
    const h = [
      entry('2026-04-30', 20, [undefined, undefined]),
      entry('2026-05-02', 20, [undefined]),
    ];
    expect(injuryWeight({ ...base, history: h }).equals(kg(22.5))).toBe(true);
  });

  it('never goes below zero', () => {
    const h = [entry('2026-04-30', 0, [7])];
    expect(injuryWeight({ ...base, history: h }).equals(kg(0))).toBe(true);
  });
  it('ignores a zero-set entry as if it were absent, without throwing', () => {
    const empty: InjuryHistoryEntry = {
      sessionId: 'empty',
      date: LocalDate.parse('2026-05-03'),
      exercise: new RecordedWeightedExercise(bp, [], undefined),
    };
    const h = [entry('2026-04-30', 20, [2, 2, 3]), empty];
    expect(injuryWeight({ ...base, history: h }).equals(kg(20))).toBe(true);
    const twoPass = [
      entry('2026-04-30', 20, [2, 3, 3]),
      entry('2026-05-02', 20, [2, 2, 3]),
      empty,
    ];
    expect(injuryWeight({ ...base, history: twoPass }).equals(kg(22.5))).toBe(
      true,
    );
  });

  it('compares and steps in the carried unit when history is in pounds', () => {
    const h = [
      entry('2026-04-30', 45, [2, 3, 3], 'pounds'),
      entry('2026-05-02', 45, [2, 2, 3], 'pounds'),
    ];
    const w = injuryWeight({ ...base, history: h });
    expect(w.unit).toBe('kilograms');
    const expected = new Weight(45, 'pounds')
      .convertTo('kilograms')
      .plus(BigNumber(2.5));
    expect(w.equals(expected)).toBe(true);
  });
});
