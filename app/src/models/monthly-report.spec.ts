import { describe, expect, it } from 'vitest';
import {
  DayOfWeek,
  Duration,
  LocalDate,
  OffsetDateTime,
  YearMonth,
} from '@js-joda/core';
import BigNumber from 'bignumber.js';
import {
  NoProgressiveOverload,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedSet,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import { monthlyReport } from '@/models/monthly-report';

const september = YearMonth.of(2026, 9);
const library = [
  { name: 'Barbell Squat', muscles: ['quadriceps', 'glutes'] },
  { name: 'Barbell Curl', muscles: ['biceps'] },
];

/** A lift with one ticked set of 10 per weight; undefined is an unticked set */
function lift(name: string, kgs: (number | undefined)[], date: string) {
  const time = OffsetDateTime.parse(`${date}T10:00:00Z`);
  return new RecordedWeightedExercise(
    new WeightedExerciseBlueprint(
      name,
      kgs.length,
      10,
      new NoProgressiveOverload(),
      Rest.medium,
      false,
      '',
      '',
    ),
    kgs.map(
      (kg, i) =>
        new PotentialSet(
          kg === undefined
            ? undefined
            : new RecordedSet(10, time.plusMinutes(i * 5)),
          new Weight(kg ?? 20, 'kilograms'),
        ),
    ),
    undefined,
  );
}

function workout(
  name: string,
  date: string,
  lifts: RecordedWeightedExercise[],
  bodyweight?: number,
) {
  return new Session(
    `${name}-${date}`,
    new SessionBlueprint(
      name,
      lifts.map((x) => x.blueprint),
      '',
    ),
    lifts,
    LocalDate.parse(date),
    bodyweight === undefined ? undefined : new Weight(bodyweight, 'kilograms'),
    undefined,
  );
}

const report = (sessions: Session[]) =>
  monthlyReport({
    sessions,
    month: september,
    unit: 'kilograms',
    library,
    firstDayOfWeek: DayOfWeek.MONDAY,
  });

describe('monthlyReport', () => {
  it('counts only finished workouts dated in the month', () => {
    const r = report([
      workout('Legs', '2026-08-31', [
        lift('Barbell Squat', [100], '2026-08-31'),
      ]),
      workout('Legs', '2026-09-01', [
        lift('Barbell Squat', [100], '2026-09-01'),
      ]),
      workout('Legs', '2026-09-30', [
        lift('Barbell Squat', [100], '2026-09-30'),
      ]),
      workout('Pull', '2026-09-15', [
        lift('Barbell Curl', [undefined], '2026-09-15'),
      ]),
      workout('Legs', '2026-10-01', [
        lift('Barbell Squat', [100], '2026-10-01'),
      ]),
    ]);

    expect(r.workouts).toBe(2);
  });

  it('adds up sets, volume and time trained', () => {
    const r = report([
      workout('Legs', '2026-09-01', [
        lift('Barbell Squat', [100, 100, undefined], '2026-09-01'),
      ]),
      workout('Arms', '2026-09-02', [lift('Barbell Curl', [30], '2026-09-02')]),
    ]);

    expect(r.sets).toBe(3);
    expect(r.volume.value.toNumber()).toBe(100 * 10 * 2 + 30 * 10);
    expect(r.timeTrained).toEqual(Duration.ofMinutes(5));
  });

  it('converts volume into the chosen unit', () => {
    const r = monthlyReport({
      sessions: [
        workout('Legs', '2026-09-01', [
          lift('Barbell Squat', [100], '2026-09-01'),
        ]),
      ],
      month: september,
      unit: 'pounds',
      library,
      firstDayOfWeek: DayOfWeek.MONDAY,
    });

    expect(r.volume.unit).toBe('pounds');
    expect(r.volume.value.toNumber()).toBeCloseTo(100 * 10 * 2.20462);
  });

  it('counts weeks with three or more workouts from the first day of the week', () => {
    const squat = (date: string) =>
      workout('Legs', date, [lift('Barbell Squat', [100], date)]);
    // Mon 7 to Sun 13 September has three; Mon 14 onwards has two
    const r = report([
      squat('2026-09-07'),
      squat('2026-09-09'),
      squat('2026-09-13'),
      squat('2026-09-14'),
      squat('2026-09-16'),
    ]);

    expect(r.weeksWithThreeOrMore).toBe(1);
  });

  it('lists lifts that beat their heaviest weight before the month, biggest gain first', () => {
    const r = report([
      workout('Legs', '2026-08-10', [
        lift('Barbell Squat', [100], '2026-08-10'),
        lift('Barbell Curl', [30], '2026-08-10'),
      ]),
      workout('Legs', '2026-09-10', [
        lift('Barbell Squat', [105], '2026-09-10'),
        lift('Barbell Curl', [35, 40], '2026-09-10'),
        lift('Leg Press', [200], '2026-09-10'),
      ]),
    ]);

    expect(
      r.bests.map((b) => [
        b.name,
        b.weight.value.toNumber(),
        b.previous.value.toNumber(),
      ]),
    ).toEqual([
      ['Barbell Curl', 40, 30],
      ['Barbell Squat', 105, 100],
    ]);
  });

  it('counts every new best though it lists only five', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const r = report([
      workout(
        'Legs',
        '2026-08-10',
        names.map((n) => lift(n, [50], '2026-08-10')),
      ),
      workout(
        'Legs',
        '2026-09-10',
        names.map((n) => lift(n, [60], '2026-09-10')),
      ),
    ]);

    expect(r.bests).toHaveLength(5);
    expect(r.bestsCount).toBe(7);
  });

  it('does not count a weight that only matches the old best', () => {
    const r = report([
      workout('Legs', '2026-08-10', [
        lift('Barbell Squat', [100], '2026-08-10'),
      ]),
      workout('Legs', '2026-09-10', [
        lift('Barbell Squat', [100], '2026-09-10'),
      ]),
    ]);

    expect(r.bests).toEqual([]);
  });

  it('gives the first and last bodyweight recorded in the month', () => {
    const squat = (date: string, kg?: number) =>
      workout('Legs', date, [lift('Barbell Squat', [100], date)], kg);
    const r = report([
      squat('2026-09-01', 82),
      squat('2026-09-10'),
      squat('2026-09-20', 80.5),
    ]);

    expect(r.bodyweightStart?.value).toEqual(new BigNumber(82));
    expect(r.bodyweightEnd?.value).toEqual(new BigNumber(80.5));
  });

  it('counts workouts by name, most first', () => {
    const r = report([
      workout('Push', '2026-09-01', [lift('Barbell Curl', [30], '2026-09-01')]),
      workout('Pull', '2026-09-02', [lift('Barbell Curl', [30], '2026-09-02')]),
      workout('Pull', '2026-09-03', [lift('Barbell Curl', [30], '2026-09-03')]),
    ]);

    expect(r.byName).toEqual([
      { name: 'Pull', count: 2 },
      { name: 'Push', count: 1 },
    ]);
  });

  it('names the most worked muscles from the month only', () => {
    const r = report([
      workout('Legs', '2026-09-01', [
        lift('Barbell Squat', [100, 100, 100], '2026-09-01'),
        lift('Barbell Curl', [30], '2026-09-01'),
      ]),
    ]);

    expect([...r.mostWorked.slice(0, 2)].sort()).toEqual([
      'gluteal',
      'quadriceps',
    ]);
    expect(r.barelyReached).not.toContain('quadriceps');
  });
});
