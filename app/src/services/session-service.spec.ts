import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import { SessionService } from '@/services/session-service';
import type { RootState } from '@/store';
import type { ProgressRepository } from '@/services/progress-repository';
import {
  AdjustByRepsProgressiveOverload,
  IncreaseAllEvenlyProgressiveOverload,
  KeyedExerciseBlueprint,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedSet,
  RecordedWeightedExercise,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import { tick } from '@/models/session-models/__test__/helpers';
import { Session } from '@/models/session-models';
import { ROLLED_OVER_GROUP } from '@/models/roll-over';
import Enumerable from 'linq';
import { LocalDate, OffsetDateTime } from '@js-joda/core';
import type { Injury } from '@/models/injury/injury';
import { REHAB_GROUP } from '@/models/injury/rehab';
import { NormalizedName } from '@/models/blueprint-models';

const overload = () => new IncreaseAllEvenlyProgressiveOverload(BigNumber(2.5));

function blueprint(name: string, sets: number, reps: number) {
  return new WeightedExerciseBlueprint(
    name,
    sets,
    reps,
    overload(),
    Rest.medium,
    false,
    '',
    '',
  );
}

function keyed(bp: WeightedExerciseBlueprint) {
  return KeyedExerciseBlueprint.fromExerciseBlueprint(bp).toString();
}

function makeService() {
  const getState = (() =>
    ({
      settings: { useImperialUnits: false },
    }) as unknown as RootState) as () => RootState;
  return new SessionService(null as unknown as ProgressRepository, getState);
}

function hydrateFirst(
  service: SessionService,
  bp: WeightedExerciseBlueprint,
  latest: Record<string, RecordedWeightedExercise | undefined>,
) {
  const session = service.hydrateSessionFromBlueprint(
    new SessionBlueprint('Test', [bp], ''),
    latest,
  );
  return session.recordedExercises[0] as RecordedWeightedExercise;
}

describe('SessionService weight carry-forward', () => {
  it('carries the last weight forward by movement when the rep scheme changed', () => {
    // History: Leg Press recorded at 3x12 @ 130kg
    const historyBp = blueprint('Leg Press', 3, 12);
    const w = new Weight(130, 'kilograms');
    const t = tick();
    const history = new RecordedWeightedExercise(
      historyBp,
      [
        new PotentialSet(new RecordedSet(12, t), w),
        new PotentialSet(new RecordedSet(12, tick()), w),
        new PotentialSet(new RecordedSet(12, tick()), w),
      ],
      undefined,
    );

    // New program uses a different scheme (4x10) -> strict key misses
    const newBp = blueprint('Leg Press', 4, 10);
    const result = hydrateFirst(makeService(), newBp, {
      [keyed(historyBp)]: history,
    });

    expect(result.potentialSets).toHaveLength(4);
    expect(result.potentialSets.every((s) => s.weight.equals(w))).toBe(true);
  });

  it('preserves per-set weights on an exact scheme match', () => {
    const bp = blueprint('Bench Press', 3, 10);
    const t = tick();
    // Last set below rep target -> not a progressive-overload success
    const history = new RecordedWeightedExercise(
      bp,
      [
        new PotentialSet(new RecordedSet(10, t), new Weight(60, 'kilograms')),
        new PotentialSet(
          new RecordedSet(10, tick()),
          new Weight(62.5, 'kilograms'),
        ),
        new PotentialSet(
          new RecordedSet(8, tick()),
          new Weight(65, 'kilograms'),
        ),
      ],
      undefined,
    );

    const result = hydrateFirst(makeService(), bp, { [keyed(bp)]: history });

    expect(result.potentialSets.map((s) => s.weight.value.toNumber())).toEqual([
      60, 62.5, 65,
    ]);
  });

  it('seeds zero weight when there is no history for the movement', () => {
    const result = hydrateFirst(
      makeService(),
      blueprint('Novel Lift', 3, 10),
      {},
    );
    expect(result.potentialSets).toHaveLength(3);
    expect(result.potentialSets.every((s) => s.weight.value.isZero())).toBe(
      true,
    );
  });
});

describe('SessionService rolls skipped lifts into the next workout', () => {
  const legs = new SessionBlueprint(
    'Legs',
    [blueprint('Hack Squat', 3, 10), blueprint('Leg Press', 3, 10)],
    '',
  );
  const push = new SessionBlueprint('Push', [blueprint('Bench', 3, 10)], '');
  // Legs finished with Leg Press done and Hack Squat never touched.
  const finishedLegs = Session.getEmptySession(
    legs,
    'kilograms',
  ).withCycledExerciseReps(1, 0, tick());

  function upcoming(currentSession: Session | undefined, count: number) {
    const getState = (() =>
      ({
        settings: { useImperialUnits: false },
        currentSession: { workoutSession: currentSession },
      }) as unknown as RootState) as () => RootState;
    const repository = {
      getOrderedSessions: () => Enumerable.from([finishedLegs]),
    } as unknown as ProgressRepository;
    const service = new SessionService(repository, getState);
    return (async () => {
      const sessions: Session[] = [];
      for await (const s of service.getUpcomingSessions([legs, push], {})) {
        sessions.push(s);
        if (sessions.length === count) break;
      }
      return sessions;
    })();
  }

  it('adds them to the next workout only', async () => {
    const [next, after] = await upcoming(undefined, 2);

    expect(
      next!.recordedExercises.map((x) => [x.blueprint.name, x.blueprint.group]),
    ).toEqual([
      ['Hack Squat', ROLLED_OVER_GROUP],
      ['Bench', undefined],
    ]);
    expect(after!.blueprint.equals(legs)).toBe(true);
  });

  it('rolls nothing while a workout is still in progress', async () => {
    const inProgress = Session.getEmptySession(push, 'kilograms');

    const [next] = await upcoming(inProgress, 1);

    expect(next!.blueprint.equals(legs)).toBe(true);
  });
});

describe('SessionService adjusts by reps', () => {
  const byReps = new AdjustByRepsProgressiveOverload(BigNumber(2.5));
  const legPress = (sets: number, reps: number) =>
    blueprint('Leg Press', sets, reps).with({ progressiveOverload: byReps });

  function stored(date: string, kg: number, reps: number[], target = 10) {
    const bp = legPress(reps.length, target);
    return new Session(
      `s-${date}`,
      new SessionBlueprint('Legs', [bp], ''),
      [
        new RecordedWeightedExercise(
          bp,
          reps.map(
            (r) =>
              new PotentialSet(
                new RecordedSet(r, tick()),
                new Weight(kg, 'kilograms'),
              ),
          ),
          undefined,
        ),
      ],
      LocalDate.parse(date),
      undefined,
      undefined,
    );
  }

  function hydrate(history: Session[]) {
    const getState = (() =>
      ({
        settings: { useImperialUnits: false },
      }) as unknown as RootState) as () => RootState;
    const repository = {
      getOrderedSessions: () => Enumerable.from(history),
    } as unknown as ProgressRepository;
    const service = new SessionService(repository, getState);
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Legs', [legPress(3, 10)], ''),
      {},
    );
    return (
      session.recordedExercises[0] as RecordedWeightedExercise
    ).potentialSets.map((x) => x.weight.value.toNumber());
  }

  it('sets every set to the weight the recent reps call for', () => {
    const recent = LocalDate.now();
    expect(
      hydrate([
        stored(recent.toString(), 50, [11]),
        stored(recent.minusDays(7).toString(), 50, [13], 15),
      ]),
    ).toEqual([50, 50, 50]);
    expect(
      hydrate([
        stored(recent.toString(), 50, [11], 15),
        stored(recent.minusDays(7).toString(), 50, [13], 15),
      ]),
    ).toEqual([47.5, 47.5, 47.5]);
  });

  it('leaves the carried-forward weight when there is no recent history', () => {
    expect(hydrate([])).toEqual([0, 0, 0]);
  });
});

function makeInjuryService(opts: {
  injury?: Partial<Injury>;
  sessions?: Session[];
  overrides?: Record<string, boolean>;
  answers?: Record<string, 'worse' | 'notWorse'>;
}) {
  const injury: Injury = {
    slug: 'shoulder',
    name: 'Shoulder',
    side: 'left',
    structures: [],
    onsetDate: '2026-04-25',
    painLimit: 5,
    firstCut: 0.5,
    status: 'active',
    screenFindings: undefined,
    trackedFrom: '2026-04-25T00:00:00Z',
    ...opts.injury,
  };
  const getState = (() =>
    ({
      settings: { useImperialUnits: false },
      injury: {
        isHydrated: true,
        injury,
        flagOverrides: opts.overrides ?? {},
        nextDayAnswers: opts.answers ?? {},
      },
    }) as unknown as RootState) as () => RootState;
  const repo = {
    getOrderedSessions: () => Enumerable.from(opts.sessions ?? []),
  } as unknown as ProgressRepository;
  return new SessionService(repo, getState);
}

describe('injury mode', () => {
  const press = blueprint('Standing Military Press', 3, 8);
  const legPress = blueprint('Leg Press', 3, 5);

  function recorded(bp: WeightedExerciseBlueprint, kg: number) {
    return new RecordedWeightedExercise(
      bp,
      Array.from(
        { length: bp.sets },
        () =>
          new PotentialSet(
            new RecordedSet(bp.repsPerSet, tick()),
            new Weight(kg, 'kilograms'),
          ),
      ),
      undefined,
    );
  }

  it('cuts a flagged lift and leaves an unflagged one alone', () => {
    const service = makeInjuryService({});
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press, legPress], ''),
      {
        [keyed(press)]: recorded(press, 40),
        [keyed(legPress)]: recorded(legPress, 100),
      },
    );
    const [p, s] = session.recordedExercises as RecordedWeightedExercise[];
    expect(
      p!.potentialSets[0]!.weight.equals(new Weight(20, 'kilograms')),
    ).toBe(true);
    expect(
      s!.potentialSets[0]!.weight.equals(new Weight(102.5, 'kilograms')),
    ).toBe(true);
  });

  it('appends the rehab block', () => {
    const service = makeInjuryService({});
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press], ''),
      {},
    );
    expect(
      session.recordedExercises.filter(
        (x) => x.blueprint.group === REHAB_GROUP,
      ),
    ).toHaveLength(13);
  });

  it('does nothing when the injury is resolved', () => {
    const service = makeInjuryService({ injury: { status: 'resolved' } });
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press], ''),
      { [keyed(press)]: recorded(press, 40) },
    );
    expect(session.recordedExercises).toHaveLength(1);
    expect(
      (
        session.recordedExercises[0] as RecordedWeightedExercise
      ).potentialSets[0]!.weight.equals(new Weight(42.5, 'kilograms')),
    ).toBe(true);
  });

  it('respects an override that unflags a lift', () => {
    const key = new NormalizedName('Standing Military Press').toString();
    const service = makeInjuryService({ overrides: { [key]: false } });
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press], ''),
      { [keyed(press)]: recorded(press, 40) },
    );
    expect(
      (
        session.recordedExercises[0] as RecordedWeightedExercise
      ).potentialSets[0]!.weight.equals(new Weight(42.5, 'kilograms')),
    ).toBe(true);
  });

  it('does not throw when state has no injury slice', () => {
    const session = makeService().hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press], ''),
      {},
    );
    expect(session.recordedExercises).toHaveLength(1);
  });

  it('cuts from the heaviest set of a ramped lift', () => {
    const service = makeInjuryService({});
    const ramped = new RecordedWeightedExercise(
      press,
      [40, 50, 60].map(
        (kg) =>
          new PotentialSet(
            new RecordedSet(press.repsPerSet, tick()),
            new Weight(kg, 'kilograms'),
          ),
      ),
      undefined,
    );
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press], ''),
      { [keyed(press)]: ramped },
    );
    const p = session.recordedExercises[0] as RecordedWeightedExercise;
    expect(p.potentialSets.map((x) => x.weight.value.toNumber())).toEqual([
      30, 30, 30,
    ]);
  });

  it('cuts from the pre-overload weight', () => {
    const service = makeInjuryService({});
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press], ''),
      { [keyed(press)]: recorded(press, 42.5) },
    );
    const p = session.recordedExercises[0] as RecordedWeightedExercise;
    expect(p.potentialSets[0]!.weight.equals(new Weight(20, 'kilograms'))).toBe(
      true,
    );
  });

  it('cuts an adjust-by-reps lift from the seeded weight, not the adjusted one', () => {
    const byRepsPress = press.with({
      progressiveOverload: new AdjustByRepsProgressiveOverload(BigNumber(2.5)),
    });
    const past = new Session(
      'old',
      new SessionBlueprint('Push', [byRepsPress], ''),
      [recorded(byRepsPress, 50)],
      LocalDate.parse('2026-04-20'),
      undefined,
      undefined,
    );
    const service = makeInjuryService({ sessions: [past] });
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [byRepsPress], ''),
      { [keyed(byRepsPress)]: recorded(byRepsPress, 42.5) },
    );
    const p = session.recordedExercises[0] as RecordedWeightedExercise;
    expect(p.potentialSets[0]!.weight.equals(new Weight(20, 'kilograms'))).toBe(
      true,
    );
  });
  it('gives the first cut when sessions since onset predate turning the mode on', () => {
    const doneAt = OffsetDateTime.parse('2026-04-30T18:00:00Z');
    const fullWeight = new RecordedWeightedExercise(
      press,
      Array.from(
        { length: press.sets },
        () =>
          new PotentialSet(
            new RecordedSet(press.repsPerSet, doneAt),
            new Weight(40, 'kilograms'),
          ),
      ),
      undefined,
    );
    const past = new Session(
      'before-mode',
      new SessionBlueprint('Push', [press], ''),
      [fullWeight],
      LocalDate.parse('2026-04-30'),
      undefined,
      undefined,
    );
    const service = makeInjuryService({
      injury: { onsetDate: '2026-04-25', trackedFrom: '2026-05-11T09:00:00Z' },
      sessions: [past],
    });
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press], ''),
      { [keyed(press)]: fullWeight },
    );
    const p = session.recordedExercises[0] as RecordedWeightedExercise;
    expect(p.potentialSets[0]!.weight.equals(new Weight(20, 'kilograms'))).toBe(
      true,
    );
  });
  it('drops a dumbbell rehab lift by 1 kg after a pain stop', () => {
    const punch = blueprint('Supine punch', 3, 15).with({
      group: REHAB_GROUP,
    });
    const doneAt = OffsetDateTime.parse('2026-05-12T18:00:00Z');
    const painful = new RecordedWeightedExercise(
      punch,
      [
        new PotentialSet(
          new RecordedSet(15, doneAt, 7),
          new Weight(5, 'kilograms'),
        ),
        new PotentialSet(undefined, new Weight(5, 'kilograms')),
        new PotentialSet(undefined, new Weight(5, 'kilograms')),
      ],
      undefined,
      true,
    );
    const past = new Session(
      'rehab-day',
      new SessionBlueprint('Push', [press, punch], ''),
      [painful],
      LocalDate.parse('2026-05-12'),
      undefined,
      undefined,
    );
    const service = makeInjuryService({ sessions: [past] });
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press], ''),
      {},
    );
    const next = session.recordedExercises.find(
      (x) => x.blueprint.name === 'Supine punch',
    ) as RecordedWeightedExercise;
    expect(
      next.potentialSets[0]!.weight.equals(new Weight(4, 'kilograms')),
    ).toBe(true);
  });
  it('leaves a bodyweight rehab lift where it is after two passed sessions', () => {
    const slide = blueprint('Wall slide', 3, 15).with({ group: REHAB_GROUP });
    const day = (id: string, date: string) =>
      new Session(
        id,
        new SessionBlueprint('Push', [press, slide], ''),
        [
          new RecordedWeightedExercise(
            slide,
            Array.from(
              { length: 3 },
              () =>
                new PotentialSet(
                  new RecordedSet(
                    15,
                    OffsetDateTime.parse(`${date}T18:00:00Z`),
                    1,
                  ),
                  new Weight(0, 'kilograms'),
                ),
            ),
            undefined,
          ),
        ],
        LocalDate.parse(date),
        undefined,
        undefined,
      );
    const service = makeInjuryService({
      sessions: [day('b', '2026-05-14'), day('a', '2026-05-12')],
    });
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press], ''),
      {},
    );
    const next = session.recordedExercises.find(
      (x) => x.blueprint.name === 'Wall slide',
    ) as RecordedWeightedExercise;
    expect(next.potentialSets[0]!.weight.value.toNumber()).toBe(0);
  });
  describe('steps from injury-era history', () => {
    // Two workouts on one day, newest first as the repository returns them.
    function day(id: string, time: string, kg: number, pain?: number) {
      const at = OffsetDateTime.parse(time);
      return new Session(
        id,
        new SessionBlueprint('Push', [press], ''),
        [
          new RecordedWeightedExercise(
            press,
            Array.from(
              { length: press.sets },
              (_, i) =>
                new PotentialSet(
                  new RecordedSet(
                    press.repsPerSet,
                    at.plusMinutes(i),
                    i === 0 ? pain : 1,
                  ),
                  new Weight(kg, 'kilograms'),
                ),
            ),
            undefined,
            pain !== undefined && pain > 5 ? true : undefined,
          ),
        ],
        at.toLocalDate(),
        undefined,
        undefined,
      );
    }

    function nextPress(service: SessionService) {
      const session = service.hydrateSessionFromBlueprint(
        new SessionBlueprint('Push', [press], ''),
        { [keyed(press)]: recorded(press, 20) },
      );
      return (
        session.recordedExercises[0] as RecordedWeightedExercise
      ).potentialSets[0]!.weight.value.toNumber();
    }

    it('drops a step when the later of two same-day workouts stopped for pain', () => {
      const earlier = day('a', '2026-05-12T08:00:00Z', 20, 1);
      const later = day('b', '2026-05-12T18:00:00Z', 20, 8);
      expect(nextPress(makeInjuryService({ sessions: [later, earlier] }))).toBe(
        17.5,
      );
    });

    it('adds a step after two passed workouts at the same weight', () => {
      const earlier = day('a', '2026-05-12T08:00:00Z', 20, 1);
      const later = day('b', '2026-05-12T18:00:00Z', 20, 2);
      expect(nextPress(makeInjuryService({ sessions: [later, earlier] }))).toBe(
        22.5,
      );
    });

    it('drops a step when the next day was worse after the latest workout', () => {
      const earlier = day('a', '2026-05-12T08:00:00Z', 20, 1);
      const later = day('b', '2026-05-12T18:00:00Z', 20, 2);
      expect(
        nextPress(
          makeInjuryService({
            sessions: [later, earlier],
            answers: { b: 'worse' },
          }),
        ),
      ).toBe(17.5);
    });

    it('holds the weight when only the earlier workout was worse the next day', () => {
      const earlier = day('a', '2026-05-12T08:00:00Z', 20, 1);
      const later = day('b', '2026-05-12T18:00:00Z', 20, 2);
      expect(
        nextPress(
          makeInjuryService({
            sessions: [later, earlier],
            answers: { a: 'worse' },
          }),
        ),
      ).toBe(20);
    });
  });
});
