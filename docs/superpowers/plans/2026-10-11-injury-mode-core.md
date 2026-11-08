# Injury mode core implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LiftLog programs around an active injury. It flags shoulder-loaded lifts, starts them at 50%, takes a pain score after each set, stops a lift above 5/10, adjusts load from pain history and a next-day check, appends a rehab block to gym sessions, and shows since-injury bests with an all-time archive.

**Architecture:** Injury state lives in a new Redux slice `injury`, persisted as one JSON value in the key-value store. The pure logic sits in small model files under `app/src/models/injury/`: flags, load rule, rehab exercises and self-screen. Each is unit-tested. `SessionService.createNewSession` reads the slice to cut weights and append the rehab block. The UI adds a settings screen, a self-screen flow, a pain picker after a set, a next-day dialog and a stats archive.

**Tech stack:** Expo / React Native, TypeScript, Redux Toolkit with listener effects (`addEffect`), react-native-paper, Tolgee i18n (`app/src/i18n/en.json`), Vitest (`npm test` in `app/`), js-joda dates, BigNumber weights.

**Spec:** `docs/superpowers/specs/2026-10-11-injury-mode-core-design.md`

## Global constraints

- Pain ceiling default `painLimit = 5`. A set with pain **greater than** 5 stops the lift.
- First cut default `firstCut = 0.5`.
- One active injury at a time.
- Every self-screen page shows: "This is a screen, not a diagnosis. A physio's assessment comes first."
- Red flag → "See a clinician now", and injury mode stays off.
- All UI copy goes through Tolgee keys in `app/src/i18n/en.json`. Follow the writing rules: no em dashes, and no captions explaining self-evident controls.
- Light theme only; use the existing `useAppTheme` colors.
- Commit messages must not mention AI tools. This repo's owner forbids attribution trailers in commits, and that overrides any default.
- Work happens in worktree `/Users/home/Projects/LiftLog-injury-mode`, branch `feat/injury-mode`. All commands run from `app/` unless stated.

## Refinements to the spec (made while reading the code; the spec is updated to match in Task 0)

1. Next-day answers are stored in the injury slice, keyed by session id, not on `Session`. Adding a field to `Session` touches its positional constructor in many places.
2. Shoulder-loaded overrides are stored in the injury slice and edited on the Injury settings screen, which lists the program's lifts with switches. The exercise editor is not changed.
3. Primary muscles for the heuristic are read from the bundled `assets/exercises.json` by name. Built-in exercises are copied into the DB once, so existing rows would never gain a new field.
4. One step is the lift's `progressiveOverload.weightIncrement`, which every overload type has. It defaults to 2.5.
5. "Rehab done" is derived: a session with any exercise in group `Rehab` that has a ticked set. Nothing is stored.
6. Pain-stopped lifts never roll over. `rolledOverExercises` only carries lifts with no ticked set, and a stopped lift has at least one. Task 3 adds a test that pins this.

## Review focus

1. **Sessions saved before this change load.** A stored set has no `pain`, and an injury JSON written by an older build may lack newer fields. Tests: Task 3 (old set JSON) and Task 1 (partial JSON).
2. **A lift recorded before the onset date is not injury history.** The first injury-era session must apply the first cut to the pre-injury weight, not reuse it. Test: Task 4.
3. **A pain prompt dismissed without an answer.** The set stays ticked with `pain` undefined and counts as a pass. Test: Task 4.
4. **Unflagged lifts are untouched.** Barbell Squat weight must not change with injury mode on. Test: Task 6.
5. **Rehab block not doubled.** Hydrating a session whose blueprint already holds the Rehab group, for example a resumed session, must not append it again. Test: Task 5.

---

### Task 0: Align the spec with the refinements

**Files:**
- Modify: `docs/superpowers/specs/2026-10-11-injury-mode-core-design.md`

- [ ] **Step 1:** Edit the spec:
  - Section 3: overrides live on the Injury settings screen, and primary muscles come from the bundled library.
  - Section 4: the step is the lift's `weightIncrement`, and the next-day answer is stored in the injury slice.
  - Section 5: "rehab done" is derived from the `Rehab` group.
  - Edge cases: replace "A lift renamed after flagging keeps its flag" with "A lift renamed after an override loses the override and falls back to the heuristic, because overrides are keyed by name."
  - Keep paragraphs on one line.
- [ ] **Step 2:** Commit.

```bash
git add ../docs/superpowers/specs/2026-10-11-injury-mode-core-design.md
git commit -m "docs: align injury mode spec with implementation choices"
```

### Task 1: Injury model, slice and persistence

**Files:**
- Create: `app/src/models/injury/injury.ts`
- Create: `app/src/store/injury/index.ts`
- Create: `app/src/store/injury/effects.ts`
- Create: `app/src/store/injury/index.spec.ts`
- Modify: `app/src/store/store.ts` (reducer `injury: injuryReducer`)
- Modify: `app/src/store/index.ts`: register `applyInjuryEffects` where `applySettingsEffects` is registered, and re-export.
- Modify: `app/src/store/app/effects.ts:25`: dispatch `initializeInjuryStateSlice()` next to `initializeSettingsStateSlice()`.

**Interfaces:**
- Produces:
  - `InjuryState`, `Injury`, `NextDayAnswer`, `parseInjuryState(json: string | undefined): InjuryState`, `serializeInjuryState(s: InjuryState): string`, `selectActiveInjury(state: RootState): Injury | undefined`
  - Actions: `setInjury(Injury | undefined)`, `resolveInjury()`, `setFlagOverride({ name: string; flagged: boolean | undefined })`, `answerNextDay({ sessionId: string; answer: NextDayAnswer })`, `initializeInjuryStateSlice()`, `hydrateInjuryState(InjuryState)`

- [ ] **Step 1: Write the model.**

```ts
// app/src/models/injury/injury.ts
export type InjurySide = 'left' | 'right';
export type InjuryStatus = 'active' | 'resolved';
export type NextDayAnswer = 'worse' | 'notWorse';

export interface ScreenFindings {
  redFlags: boolean;
  painfulArc: boolean | undefined;
  dropArm: boolean | undefined;
  passiveAsLimitedAsActive: boolean | undefined;
  neckSymptoms: boolean | undefined;
  scapularSymptoms: boolean | undefined;
  /** ISO date the screen was taken */
  takenOn: string;
}

export interface Injury {
  slug: string;
  name: string;
  side: InjurySide;
  structures: string[];
  /** ISO local date, e.g. 2026-01-05 */
  onsetDate: string;
  painLimit: number;
  firstCut: number;
  status: InjuryStatus;
  screenFindings: ScreenFindings | undefined;
}

export interface InjuryState {
  isHydrated: boolean;
  injury: Injury | undefined;
  /** normalized exercise name -> forced flag; absent means use the heuristic */
  flagOverrides: Record<string, boolean>;
  /** session id -> answer to "worse than before that session?" */
  nextDayAnswers: Record<string, NextDayAnswer>;
}

export const emptyInjuryState: InjuryState = {
  isHydrated: false,
  injury: undefined,
  flagOverrides: {},
  nextDayAnswers: {},
};

export const defaultPainLimit = 5;
export const defaultFirstCut = 0.5;

export function parseInjuryState(json: string | undefined): InjuryState {
  if (!json) {
    return { ...emptyInjuryState, isHydrated: true };
  }
  try {
    const raw = JSON.parse(json) as Partial<InjuryState>;
    const injury = raw.injury
      ? {
          painLimit: defaultPainLimit,
          firstCut: defaultFirstCut,
          structures: [],
          status: 'active' as const,
          screenFindings: undefined,
          ...raw.injury,
        }
      : undefined;
    return {
      isHydrated: true,
      injury,
      flagOverrides: raw.flagOverrides ?? {},
      nextDayAnswers: raw.nextDayAnswers ?? {},
    };
  } catch {
    return { ...emptyInjuryState, isHydrated: true };
  }
}

export function serializeInjuryState(state: InjuryState): string {
  const { isHydrated: _, ...rest } = state;
  return JSON.stringify(rest);
}
```

- [ ] **Step 2: Write the failing slice tests.**

```ts
// app/src/store/injury/index.spec.ts
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
} from '@/models/injury/injury';

const cuff: Injury = {
  slug: 'shoulder',
  name: 'Shoulder',
  side: 'left',
  structures: ['supraspinatus'],
  onsetDate: '2026-01-05',
  painLimit: 5,
  firstCut: 0.5,
  status: 'active',
  screenFindings: undefined,
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
        injury: { slug: 'x', name: 'X', side: 'left', onsetDate: '2026-01-05' },
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

  it('treats missing or corrupt storage as no injury', () => {
    expect(parseInjuryState(undefined).injury).toBeUndefined();
    expect(parseInjuryState('{not json').injury).toBeUndefined();
  });
});
```

- [ ] **Step 3:** Run `npx vitest run src/store/injury`. Expected: FAIL, because `@/store/injury` does not exist.

- [ ] **Step 4: Write the slice.**

```ts
// app/src/store/injury/index.ts
import {
  emptyInjuryState,
  Injury,
  InjuryState,
  NextDayAnswer,
} from '@/models/injury/injury';
import { createAction, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';

export const initializeInjuryStateSlice = createAction(
  'initializeInjuryStateSlice',
);

const injurySlice = createSlice({
  name: 'injury',
  initialState: emptyInjuryState,
  reducers: {
    hydrateInjuryState(_, action: PayloadAction<InjuryState>) {
      return action.payload;
    },
    setInjury(state, action: PayloadAction<Injury | undefined>) {
      state.injury = action.payload;
    },
    resolveInjury(state) {
      if (state.injury) {
        state.injury.status = 'resolved';
      }
    },
    setFlagOverride(
      state,
      action: PayloadAction<{ name: string; flagged: boolean | undefined }>,
    ) {
      if (action.payload.flagged === undefined) {
        delete state.flagOverrides[action.payload.name];
      } else {
        state.flagOverrides[action.payload.name] = action.payload.flagged;
      }
    },
    answerNextDay(
      state,
      action: PayloadAction<{ sessionId: string; answer: NextDayAnswer }>,
    ) {
      state.nextDayAnswers[action.payload.sessionId] = action.payload.answer;
    },
  },
});

export const {
  hydrateInjuryState,
  setInjury,
  resolveInjury,
  setFlagOverride,
  answerNextDay,
} = injurySlice.actions;
export const injuryReducer = injurySlice.reducer;

export const selectActiveInjury = (state: RootState): Injury | undefined =>
  state.injury.injury?.status === 'active' ? state.injury.injury : undefined;
```

```ts
// app/src/store/injury/effects.ts
import { AddEffectFn } from '@/store/store';
import {
  answerNextDay,
  hydrateInjuryState,
  initializeInjuryStateSlice,
  resolveInjury,
  setFlagOverride,
  setInjury,
} from '@/store/injury';
import {
  parseInjuryState,
  serializeInjuryState,
} from '@/models/injury/injury';
import { isAnyOf } from '@reduxjs/toolkit';

const storageKey = 'injury';

export function applyInjuryEffects(addEffect: AddEffectFn) {
  addEffect(
    initializeInjuryStateSlice,
    async (_, { dispatch, extra: { keyValueStore } }) => {
      dispatch(
        hydrateInjuryState(
          parseInjuryState(await keyValueStore.getItem(storageKey)),
        ),
      );
    },
  );
  addEffect(
    isAnyOf(setInjury, resolveInjury, setFlagOverride, answerNextDay),
    async (_, { stateAfterReduce, extra: { keyValueStore } }) => {
      if (!stateAfterReduce.injury.isHydrated) {
        return;
      }
      await keyValueStore.setItem(
        storageKey,
        serializeInjuryState(stateAfterReduce.injury),
      );
    },
  );
}
```

Check that `addEffect` accepts a matcher from `isAnyOf`: read the overloads at `app/src/store/store.ts:64-80`. If it only takes action creators, register one effect per action with the same body.

- [ ] **Step 5:** Wire everything up:
  - Add `injury: injuryReducer` to `combineReducers` in `store.ts`.
  - Register `applyInjuryEffects(addEffect)` next to `applySettingsEffects` in `store/index.ts`.
  - Dispatch `initializeInjuryStateSlice()` in `store/app/effects.ts` after `initializeSettingsStateSlice()`.

  Any test that hand-builds a `RootState` (for example `makeService` in `session-service.spec.ts`) keeps compiling because it casts through `unknown`.
- [ ] **Step 6:** Run `npx vitest run src/store/injury && npm run typecheck`. Expected: PASS.
- [ ] **Step 7:** Commit.

```bash
git add src/models/injury src/store/injury src/store/store.ts src/store/index.ts src/store/app/effects.ts
git commit -m "feat: injury state slice with persistence"
```

### Task 2: Shoulder-loaded flag heuristic

**Files:**
- Create: `app/src/models/injury/flags.ts`
- Test: `app/src/models/injury/flags.spec.ts`

**Interfaces:**
- Produces: `isShoulderLoaded(name: string, overrides: Record<string, boolean>): boolean`, where the override key is `NormalizedName` of the name, built as `new NormalizedName(name).toString()`. Check that constructor in `app/src/models/blueprint-models/index.ts:699`; if it differs, use whatever the codebase uses to normalise a bare name.

- [ ] **Step 1: Write the failing tests.**

```ts
// app/src/models/injury/flags.spec.ts
import { describe, it, expect } from 'vitest';
import { isShoulderLoaded } from '@/models/injury/flags';

describe('isShoulderLoaded', () => {
  it.each([
    'Standing Military Press',
    'Barbell Bench Press - Medium Grip',
    'Dumbbell Bench Press',
    'Dips - Triceps Version',
    'Upright Barbell Row',
    'Seated Barbell Military Press',
    'Floor Press',
    'Side Lateral Raise',
  ])('flags %s', (name) => {
    expect(isShoulderLoaded(name, {})).toBe(true);
  });

  it.each(['Barbell Squat', 'Barbell Curl', 'Pullups', 'Leg Press'])(
    'does not flag %s',
    (name) => {
      expect(isShoulderLoaded(name, {})).toBe(false);
    },
  );

  it('honours an override either way', () => {
    expect(
      isShoulderLoaded('Barbell Squat', { 'barbell squat': true }),
    ).toBe(true);
    expect(
      isShoulderLoaded('Standing Military Press', {
        'standing military press': false,
      }),
    ).toBe(false);
  });
});
```

Side Lateral Raise is caught by the library rule (force push, shoulders primary) and not by the name rule. If the library lists its force as pull, its name contains no flag word, and the test fails, add `lateral raise` to the name patterns. Do not change the test.

- [ ] **Step 2:** Run `npx vitest run src/models/injury/flags`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement.**

```ts
// app/src/models/injury/flags.ts
import { NormalizedName } from '@/models/blueprint-models';
import library from '../../../assets/exercises.json';

/**
 * Positions the shoulder rehab protocols treat with care: overhead pressing,
 * behind-the-neck work, horizontal pressing and dips, and upright rows (end-range
 * internal rotation). Flagged by position, not by muscle (spec section 3).
 */
const namePatterns = [
  /overhead/,
  /military/,
  /shoulder press/,
  /behind (the )?neck/,
  /upright .*row/,
  /\bdips?\b/,
  /bench press/,
  /floor press/,
  /push press/,
  /arnold/,
];

const pushShoulderPrimary = new Set(
  (library as { exercises: { name: string; force: string | null; primaryMuscles: string[] }[] }).exercises
    .filter((x) => x.force === 'push' && x.primaryMuscles.includes('shoulders'))
    .map((x) => x.name.toLowerCase()),
);

export function isShoulderLoaded(
  name: string,
  overrides: Record<string, boolean>,
): boolean {
  const key = new NormalizedName(name).toString();
  const override = overrides[key];
  if (override !== undefined) {
    return override;
  }
  const lower = name.toLowerCase();
  return (
    namePatterns.some((p) => p.test(lower)) || pushShoulderPrimary.has(lower)
  );
}
```

- [ ] **Step 4:** Run the tests. Expected: PASS. The override keys in the test assume `NormalizedName` lowercases and trims. If it normalises differently, change the test keys to `new NormalizedName('Barbell Squat').toString()`.
- [ ] **Step 5:** Commit: `git add src/models/injury/flags* && git commit -m "feat: flag shoulder-loaded lifts by position"`

### Task 3: Pain on recorded sets

**Files:**
- Modify: `app/src/models/storage/versions/v1/session.ts:59-65`: add `pain?: number | undefined;` to `RecordedSetJSON`, with the `@asType integer` JSDoc.
- Modify: `app/src/models/session-models/recorded-weighted-exercise.ts`:
  - `RecordedSet` gets a third constructor arg `readonly pain: number | undefined = undefined`, plus `fromJSON`, `toJSON`, `equals` and `with` support.
  - `RecordedWeightedExercise` gets `withSetPain(setIndex: number, pain: number | undefined)` and `stoppedForPainAt(painLimit: number): number | undefined`.
- Modify: `docs/schemas/workout-worker/RecordedSet.json`: add `"pain": { "type": "integer" }` as an optional property.
- Modify: plaintext export. Find it with `grep -rn "repsCompleted" app/src/services | grep -i plain`, and append `pain` as a column when present (see `docs/PlaintextExport.md`; update that doc's column list too).
- Test: `app/src/models/session-models/recorded-weighted-exercise.spec.ts` (create if missing), and add a case to `app/src/models/roll-over.spec.ts` if it exists, or else to `session-service.spec.ts`.

**Interfaces:**
- Produces: `RecordedSet.pain`, `RecordedWeightedExercise.withSetPain`, `RecordedWeightedExercise.stoppedForPainAt(limit)`. The last returns the index of the first set whose pain exceeds the limit, or `undefined`.

- [ ] **Step 1: Write the failing tests.**

```ts
import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import { OffsetDateTime } from '@js-joda/core';
import {
  IncreaseAllEvenlyProgressiveOverload,
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
import { rolledOverExercises } from '@/models/roll-over';
import { LocalDate } from '@js-joda/core';

const bp = new WeightedExerciseBlueprint(
  'Standing Military Press', 3, 8,
  new IncreaseAllEvenlyProgressiveOverload(BigNumber(2.5)),
  Rest.medium, false, '', '',
);
const now = OffsetDateTime.now();
const done = (pain?: number) =>
  new PotentialSet(new RecordedSet(8, now, pain), new Weight(20, 'kilograms'));
const open = () => new PotentialSet(undefined, new Weight(20, 'kilograms'));

describe('pain on sets', () => {
  it('loads a set saved before pain existed', () => {
    const set = RecordedSet.fromJSON(
      new RecordedSet(8, now).toJSON() as never,
    );
    expect(set.pain).toBeUndefined();
  });

  it('round-trips pain', () => {
    expect(RecordedSet.fromJSON(new RecordedSet(8, now, 4).toJSON()).pain).toBe(4);
  });

  it('withSetPain sets pain on a completed set only', () => {
    const ex = new RecordedWeightedExercise(bp, [done(), open(), open()], undefined);
    expect(ex.withSetPain(0, 6).potentialSets[0]!.set!.pain).toBe(6);
    expect(ex.withSetPain(1, 6)).toBe(ex);
  });

  it('finds the set that went over the limit', () => {
    const ex = new RecordedWeightedExercise(bp, [done(3), done(6), open()], undefined);
    expect(ex.stoppedForPainAt(5)).toBe(1);
    expect(ex.stoppedForPainAt(6)).toBeUndefined();
  });

  it('a pain-stopped lift does not roll over', () => {
    const ex = new RecordedWeightedExercise(bp, [done(6), open(), open()], undefined);
    const session = new Session(
      'id', new SessionBlueprint('Push', [bp], ''), [ex],
      LocalDate.now(), undefined, undefined,
    );
    expect(rolledOverExercises(session)).toEqual([]);
  });
});
```

Check that `Session`'s constructor takes these six arguments by reading `session-models/session.ts:39`. Use the same call shape as `session-service.ts` (`new Session(uuid(), blueprint, exercises, LocalDate.now(), undefined, undefined)`).

- [ ] **Step 2:** Run it. Expected: FAIL (`pain` does not exist).
- [ ] **Step 3: Implement.** In `RecordedSet`:

```ts
export class RecordedSet {
  constructor(
    readonly repsCompleted: number,
    readonly completionDateTime: OffsetDateTime,
    readonly pain: number | undefined = undefined,
  ) {}

  static fromJSON(json: RecordedSetJSON): RecordedSet {
    return new RecordedSet(
      json.repsCompleted,
      fromOffsetDateTimeJSON(json.completionDateTime),
      json.pain,
    );
  }

  equals(other: RecordedSet | undefined): boolean {
    if (!other) {
      return false;
    }
    if (other === this) {
      return true;
    }
    return (
      this.repsCompleted === other.repsCompleted &&
      this.completionDateTime.equals(other.completionDateTime) &&
      this.pain === other.pain
    );
  }

  with(other: Partial<RecordedSet>): RecordedSet {
    return new RecordedSet(
      'repsCompleted' in other ? other.repsCompleted! : this.repsCompleted,
      'completionDateTime' in other
        ? other.completionDateTime!
        : this.completionDateTime,
      'pain' in other ? other.pain : this.pain,
    );
  }

  toJSON(): RecordedSetJSON {
    return {
      repsCompleted: this.repsCompleted,
      completionDateTime: toOffsetDateTimeJSON(this.completionDateTime),
      ...(this.pain === undefined ? {} : { pain: this.pain }),
    };
  }
}
```

In `RecordedWeightedExercise`, add these after `isSuccessForProgressiveOverload`:

```ts
  withSetPain(setIndex: number, pain: number | undefined): RecordedWeightedExercise {
    const ps = this.potentialSets[setIndex];
    if (!ps?.set) {
      return this;
    }
    return new RecordedWeightedExercise(
      this.blueprint,
      this.potentialSets.with(setIndex, ps.with({ set: ps.set.with({ pain }) })),
      this.notes,
    );
  }

  /** Index of the first set whose pain went over the limit, if any */
  stoppedForPainAt(painLimit: number): number | undefined {
    const i = this.potentialSets.findIndex(
      (x) => x.set?.pain !== undefined && x.set.pain > painLimit,
    );
    return i === -1 ? undefined : i;
  }
```

Then do the schema JSON and plaintext export edits listed above. Search for other `new RecordedSet(` call sites with `grep -rn "new RecordedSet(" src`. They keep working because the argument is optional.
- [ ] **Step 4:** Run `npx vitest run src/models && npm run typecheck`. Expected: PASS, including existing storage and migrator specs.
- [ ] **Step 5:** Commit: `git add -A src ../docs && git commit -m "feat: record pain on a completed set"`

### Task 4: Injury load rule

**Files:**
- Create: `app/src/models/injury/load.ts`
- Test: `app/src/models/injury/load.spec.ts`

**Interfaces:**
- Consumes: `RecordedWeightedExercise.stoppedForPainAt` (Task 3), `NextDayAnswer` (Task 1).
- Produces:

```ts
export interface InjuryHistoryEntry {
  sessionId: string;
  date: LocalDate;
  exercise: RecordedWeightedExercise;
}
export function injuryWeight(args: {
  /** recordings of this lift, any order; filtered to on/after onset inside */
  history: InjuryHistoryEntry[];
  onsetDate: LocalDate;
  /** weight the normal rules would give */
  carried: Weight;
  increment: BigNumber;
  painLimit: number;
  firstCut: number;
  nextDayAnswers: Record<string, NextDayAnswer>;
}): Weight;
export function sessionPassed(e: InjuryHistoryEntry, painLimit: number, answers: Record<string, NextDayAnswer>): boolean;
```

Rules:
- `era` is the history on or after the onset date, sorted ascending by date.
- If `era` is empty, return `carried × firstCut`, rounded **down** to a multiple of `increment`.
- Otherwise `base` is the heaviest weight among the last entry's completed sets, falling back to its first potential set's weight.
- If the last entry did not pass, return `max(base − increment, 0)`.
- If the last two entries both passed and both have `base` as their heaviest weight, return `base + increment`.
- Otherwise return `base`.
- A session passes when no set's pain exceeds the limit and its next-day answer is not `worse`. Unanswered counts as a pass.

- [ ] **Step 1: Write the failing tests.**

```ts
// app/src/models/injury/load.spec.ts
import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import { LocalDate, OffsetDateTime } from '@js-joda/core';
import { injuryWeight, InjuryHistoryEntry } from '@/models/injury/load';
import {
  IncreaseAllEvenlyProgressiveOverload, Rest, WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { PotentialSet, RecordedSet, RecordedWeightedExercise } from '@/models/session-models';
import { Weight } from '@/models/weight';

const bp = new WeightedExerciseBlueprint(
  'Standing Military Press', 3, 8,
  new IncreaseAllEvenlyProgressiveOverload(BigNumber(2.5)), Rest.medium, false, '', '',
);
const kg = (n: number) => new Weight(n, 'kilograms');
const onset = LocalDate.parse('2026-01-05');
let n = 0;
function entry(date: string, weight: number, pains: (number | undefined)[]): InjuryHistoryEntry {
  return {
    sessionId: `s${n++}`,
    date: LocalDate.parse(date),
    exercise: new RecordedWeightedExercise(
      bp,
      pains.map((p) => new PotentialSet(new RecordedSet(8, OffsetDateTime.now(), p), kg(weight))),
      undefined,
    ),
  };
}
const base = {
  onsetDate: onset, carried: kg(41), increment: BigNumber(2.5),
  painLimit: 5, firstCut: 0.5, nextDayAnswers: {},
};

describe('injuryWeight', () => {
  it('cuts the carried weight on the first injury-era session, rounding down', () => {
    expect(injuryWeight({ ...base, history: [] }).equals(kg(20))).toBe(true);
  });

  it('ignores recordings before the onset date', () => {
    const h = [entry('2026-01-01', 40, [2, 2, 2])];
    expect(injuryWeight({ ...base, history: h }).equals(kg(20))).toBe(true);
  });

  it('keeps the weight after one passing session', () => {
    const h = [entry('2026-01-10', 20, [2, 3, 3])];
    expect(injuryWeight({ ...base, history: h }).equals(kg(20))).toBe(true);
  });

  it('adds a step after two passing sessions at the same weight', () => {
    const h = [entry('2026-01-10', 20, [2, 3, 3]), entry('2026-01-12', 20, [2, 2, 3])];
    expect(injuryWeight({ ...base, history: h }).equals(kg(22.5))).toBe(true);
  });

  it('does not add again straight after a step', () => {
    const h = [
      entry('2026-01-10', 20, [2, 3, 3]),
      entry('2026-01-12', 20, [2, 2, 3]),
      entry('2026-01-14', 22.5, [2, 2, 3]),
    ];
    expect(injuryWeight({ ...base, history: h }).equals(kg(22.5))).toBe(true);
  });

  it('drops a step when a set went over the limit', () => {
    const h = [entry('2026-01-10', 20, [3, 6])];
    expect(injuryWeight({ ...base, history: h }).equals(kg(17.5))).toBe(true);
  });

  it('drops a step when the next day was worse', () => {
    const e = entry('2026-01-10', 20, [2, 2, 2]);
    expect(
      injuryWeight({ ...base, history: [e], nextDayAnswers: { [e.sessionId]: 'worse' } })
        .equals(kg(17.5)),
    ).toBe(true);
  });

  it('counts an unanswered pain prompt as a pass', () => {
    const h = [entry('2026-01-10', 20, [undefined, undefined]), entry('2026-01-12', 20, [undefined])];
    expect(injuryWeight({ ...base, history: h }).equals(kg(22.5))).toBe(true);
  });

  it('never goes below zero', () => {
    const h = [entry('2026-01-10', 0, [7])];
    expect(injuryWeight({ ...base, history: h }).equals(kg(0))).toBe(true);
  });
});
```

- [ ] **Step 2:** Run it. Expected: FAIL, module missing.
- [ ] **Step 3: Implement.**

```ts
// app/src/models/injury/load.ts
import BigNumber from 'bignumber.js';
import { LocalDate } from '@js-joda/core';
import { RecordedWeightedExercise } from '@/models/session-models';
import { Weight } from '@/models/weight';
import { NextDayAnswer } from '@/models/injury/injury';

export interface InjuryHistoryEntry {
  sessionId: string;
  date: LocalDate;
  exercise: RecordedWeightedExercise;
}

export function sessionPassed(
  e: InjuryHistoryEntry,
  painLimit: number,
  answers: Record<string, NextDayAnswer>,
): boolean {
  return (
    e.exercise.stoppedForPainAt(painLimit) === undefined &&
    answers[e.sessionId] !== 'worse'
  );
}

function heaviest(e: InjuryHistoryEntry): Weight {
  const done = e.exercise.potentialSets.filter((x) => x.set);
  const sets = done.length ? done : e.exercise.potentialSets.slice(0, 1);
  return Weight.max(...sets.map((x) => x.weight));
}

export function injuryWeight(args: {
  history: InjuryHistoryEntry[];
  onsetDate: LocalDate;
  carried: Weight;
  increment: BigNumber;
  painLimit: number;
  firstCut: number;
  nextDayAnswers: Record<string, NextDayAnswer>;
}): Weight {
  const { increment, painLimit, nextDayAnswers } = args;
  const era = args.history
    .filter((x) => !x.date.isBefore(args.onsetDate))
    .sort((a, b) => a.date.compareTo(b.date));
  const last = era[era.length - 1];
  if (!last) {
    const cut = args.carried.value.multipliedBy(args.firstCut);
    const rounded = increment.isZero()
      ? cut
      : cut.dividedBy(increment).integerValue(BigNumber.ROUND_FLOOR).multipliedBy(increment);
    return args.carried.with({ value: rounded });
  }
  const base = heaviest(last);
  if (!sessionPassed(last, painLimit, nextDayAnswers)) {
    const lower = base.value.minus(increment);
    return base.with({ value: BigNumber.max(lower, 0) });
  }
  const prev = era[era.length - 2];
  if (
    prev &&
    sessionPassed(prev, painLimit, nextDayAnswers) &&
    heaviest(prev).equals(base)
  ) {
    return base.plus(increment);
  }
  return base;
}
```

Check the `Weight` field name (`value`) and `with`/`plus` signatures in `app/src/models/weight.ts:16-66` before running. Adapt the property name if it differs.

- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `git add src/models/injury/load* && git commit -m "feat: injury load rule from pain history"`

### Task 5: Rehab exercises and rehab block

**Files:**
- Create: `app/src/models/injury/rehab.ts`
- Test: `app/src/models/injury/rehab.spec.ts`
- Modify: `app/src/store/stored-sessions/effects.ts`. After the built-in merge (around line 104), add each rehab descriptor whose name is not already in `savedExercises` or the built-ins, using the same `updateExercise` dispatch.

**Interfaces:**
- Produces: `REHAB_GROUP = 'Rehab'`, `rehabExercises: RehabExercise[]`, `withRehabBlock(blueprint: SessionBlueprint, structures: string[]): SessionBlueprint`, `isRehabDone(session: Session): boolean`, `rehabDescriptors(): ExerciseDescriptor[]`.

- [ ] **Step 1: Write the failing tests.**

```ts
// app/src/models/injury/rehab.spec.ts
import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import {
  IncreaseAllEvenlyProgressiveOverload, Rest, SessionBlueprint, WeightedExerciseBlueprint,
  CardioExerciseBlueprint,
} from '@/models/blueprint-models';
import { REHAB_GROUP, rehabExercises, withRehabBlock } from '@/models/injury/rehab';

const press = new WeightedExerciseBlueprint(
  'Standing Military Press', 3, 8,
  new IncreaseAllEvenlyProgressiveOverload(BigNumber(2.5)), Rest.medium, false, '', '',
);
const push = new SessionBlueprint('Push', [press], '');

describe('rehab block', () => {
  it('has the 13 sourced exercises', () => {
    expect(rehabExercises).toHaveLength(13);
  });

  it('appends exercises matching the structures, plus the stretch, at the end', () => {
    const out = withRehabBlock(push, ['serratus anterior']);
    const names = out.exercises.slice(1).map((x) => x.name);
    expect(out.exercises[0]).toBe(press);
    expect(names).toEqual([
      'Push-up plus, elbows',
      'Supine punch',
      'Wall slide',
      'Cross-body posterior shoulder stretch',
    ]);
    expect(out.exercises.slice(1).every((x) => x.group === REHAB_GROUP)).toBe(true);
  });

  it('appends all 13 when no structures are set', () => {
    expect(withRehabBlock(push, []).exercises).toHaveLength(14);
  });

  it('does not append twice', () => {
    const once = withRehabBlock(push, []);
    expect(withRehabBlock(once, []).exercises).toHaveLength(14);
  });

  it('leaves a session with no weighted lifts alone', () => {
    const cardioOnly = new SessionBlueprint('Run', [], '');
    expect(withRehabBlock(cardioOnly, [])).toBe(cardioOnly);
  });
});
```

- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.** Doses come from spec section 5. Holds and the stretch are encoded as reps, with the hold time in notes.

```ts
// app/src/models/injury/rehab.ts
import BigNumber from 'bignumber.js';
import {
  IncreaseAllEvenlyProgressiveOverload,
  NormalizedName,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { RecordedWeightedExercise, Session } from '@/models/session-models';
import { ExerciseDescriptor } from '@/models/exercise-models';

export const REHAB_GROUP = 'Rehab';

export interface RehabExercise {
  name: string;
  structures: string[];
  sets: number;
  reps: number;
  notes: string;
  source: string;
  /** library muscle names, for the exercise list */
  muscles: string[];
  equipment: string | null;
}

const stretch = 'Cross-body posterior shoulder stretch';

export const rehabExercises: RehabExercise[] = [
  { name: 'Isometric abduction, wall', structures: ['supraspinatus'], sets: 3, reps: 10, notes: 'Press the back of the hand into a wall, 5 s holds.', source: 'Littlewood', muscles: ['shoulders'], equipment: 'body only' },
  { name: 'Abduction 80 to 120 degrees, dumbbell', structures: ['supraspinatus', 'deltoid'], sets: 3, reps: 10, notes: 'Raise only through 80 to 120 degrees.', source: 'Littlewood', muscles: ['shoulders'], equipment: 'dumbbell' },
  { name: 'Eccentric full can', structures: ['supraspinatus'], sets: 3, reps: 15, notes: 'Thumb up, lower over 3 s.', source: 'Holmgren', muscles: ['shoulders'], equipment: 'dumbbell' },
  { name: 'Side-lying external rotation, dumbbell', structures: ['infraspinatus', 'teres minor', 'lower trapezius'], sets: 3, reps: 15, notes: '', source: 'Holmgren, Cools', muscles: ['shoulders'], equipment: 'dumbbell' },
  { name: 'Banded eccentric external rotation', structures: ['infraspinatus', 'teres minor'], sets: 3, reps: 15, notes: 'Lower over 3 s.', source: 'Holmgren', muscles: ['shoulders'], equipment: 'bands' },
  { name: 'Low row, isometric', structures: ['rhomboids', 'middle trapezius', 'lower trapezius'], sets: 3, reps: 20, notes: '', source: 'RoCTEx, Cools', muscles: ['middle back'], equipment: 'body only' },
  { name: 'Push-up plus, elbows', structures: ['serratus anterior'], sets: 3, reps: 20, notes: 'From the elbows, push the shoulder blades apart at the top.', source: 'RoCTEx, Cools', muscles: ['chest', 'shoulders'], equipment: 'body only' },
  { name: 'Supine punch', structures: ['serratus anterior'], sets: 3, reps: 15, notes: '', source: 'Cools', muscles: ['chest', 'shoulders'], equipment: 'dumbbell' },
  { name: 'Wall slide', structures: ['serratus anterior', 'lower trapezius'], sets: 3, reps: 15, notes: '', source: 'Cools', muscles: ['shoulders', 'middle back'], equipment: 'body only' },
  { name: 'Prone horizontal abduction with external rotation', structures: ['lower trapezius', 'middle trapezius'], sets: 3, reps: 15, notes: '', source: 'Cools', muscles: ['middle back', 'shoulders'], equipment: 'dumbbell' },
  { name: 'Prone extension', structures: ['lower trapezius', 'middle trapezius'], sets: 3, reps: 15, notes: '', source: 'Cools', muscles: ['middle back'], equipment: 'dumbbell' },
  { name: 'Side-lying forward flexion', structures: ['lower trapezius'], sets: 3, reps: 15, notes: '', source: 'Cools', muscles: ['shoulders'], equipment: 'dumbbell' },
  { name: stretch, structures: ['posterior capsule'], sets: 3, reps: 1, notes: 'Hold 30 s.', source: 'Holmgren', muscles: ['shoulders'], equipment: 'body only' },
];

function toBlueprint(x: RehabExercise): WeightedExerciseBlueprint {
  return new WeightedExerciseBlueprint(
    x.name, x.sets, x.reps,
    new IncreaseAllEvenlyProgressiveOverload(BigNumber(0)),
    Rest.short, false, `${x.notes} Source: ${x.source}.`.trim(), '', REHAB_GROUP,
  );
}

export function withRehabBlock(
  blueprint: SessionBlueprint,
  structures: string[],
): SessionBlueprint {
  const hasWeighted = blueprint.exercises.some(
    (x) => x instanceof WeightedExerciseBlueprint && x.group !== REHAB_GROUP,
  );
  if (!hasWeighted || blueprint.exercises.some((x) => x.group === REHAB_GROUP)) {
    return blueprint;
  }
  const wanted = new Set(structures);
  const chosen = wanted.size
    ? rehabExercises.filter(
        (x) => x.name === stretch || x.structures.some((s) => wanted.has(s)),
      )
    : rehabExercises;
  const planned = new Set(
    blueprint.exercises.map((x) => NormalizedName.fromExerciseBlueprint(x).toString()),
  );
  const toAdd = chosen
    .map(toBlueprint)
    .filter((x) => !planned.has(NormalizedName.fromExerciseBlueprint(x).toString()));
  return blueprint.with({ exercises: [...blueprint.exercises, ...toAdd] });
}

export function isRehabDone(session: Session): boolean {
  return session.recordedExercises.some(
    (x) =>
      x instanceof RecordedWeightedExercise &&
      x.blueprint.group === REHAB_GROUP &&
      x.potentialSets.some((s) => s.set),
  );
}

export function rehabDescriptors(): ExerciseDescriptor[] {
  return rehabExercises.map((x) => ({
    name: x.name,
    force: null,
    level: 'beginner',
    mechanic: 'isolation',
    equipment: x.equipment,
    muscles: x.muscles,
    instructions: `${x.notes} Targets: ${x.structures.join(', ')}. Source: ${x.source}.`.trim(),
    category: 'strength',
  }));
}
```

Check the `WeightedExerciseBlueprint` constructor's argument order at `app/src/models/blueprint-models/index.ts` (the class at roughly line 640). Confirm that `group` is the ninth argument; `session-service.spec.ts` shows the first eight. Check that `Rest.short` exists, and use `Rest.medium` if it does not.

Then the library merge in `store/stored-sessions/effects.ts`, after `builtInExercisesNotAlreadyAdded` is computed:

```ts
      const knownNames = new Set(
        [...Object.values(savedExercises), ...Object.values(builtInExercisesNotAlreadyAdded)]
          .map((x) => x.name.toLowerCase()),
      );
      for (const d of rehabDescriptors()) {
        if (!knownNames.has(d.name.toLowerCase())) {
          builtInExercisesNotAlreadyAdded[d.name] = d;
        }
      }
```

Rehab names are not in `exercises.json`, so the `builtinExercisesAddedInThePast` bookkeeping records them like any built-in, and they are added once.

- [ ] **Step 4:** Run `npx vitest run src/models/injury src/store/stored-sessions`. Expected: PASS.
- [ ] **Step 5:** Commit: `git add src/models/injury/rehab* src/store/stored-sessions/effects.ts && git commit -m "feat: sourced shoulder rehab exercises and rehab block"`

### Task 6: Session service applies injury mode

**Files:**
- Modify: `app/src/services/session-service.ts`
- Test: `app/src/services/session-service.spec.ts` (new `describe('injury mode')`)

**Interfaces:**
- Consumes: `selectActiveInjury` (Task 1), `isShoulderLoaded` (Task 2), `injuryWeight` / `InjuryHistoryEntry` (Task 4), `withRehabBlock` / `REHAB_GROUP` (Task 5).

- [ ] **Step 1: Write the failing tests.** Extend `makeService` to accept state and sessions:

```ts
function makeInjuryService(opts: {
  injury?: Partial<Injury>;
  sessions?: Session[];
  overrides?: Record<string, boolean>;
}) {
  const injury: Injury = {
    slug: 'shoulder', name: 'Shoulder', side: 'left', structures: [],
    onsetDate: '2026-01-05', painLimit: 5, firstCut: 0.5, status: 'active',
    screenFindings: undefined, ...opts.injury,
  };
  const getState = (() =>
    ({
      settings: { useImperialUnits: false },
      injury: {
        isHydrated: true, injury,
        flagOverrides: opts.overrides ?? {}, nextDayAnswers: {},
      },
    }) as unknown as RootState) as () => RootState;
  const repo = {
    getOrderedSessions: () => Enumerable.from(opts.sessions ?? []),
  } as unknown as ProgressRepository;
  return new SessionService(repo, getState);
}
```

Tests:

```ts
describe('injury mode', () => {
  const press = blueprint('Standing Military Press', 3, 8);
  const squat = blueprint('Barbell Squat', 3, 5);

  function recorded(bp: WeightedExerciseBlueprint, kg: number) {
    return new RecordedWeightedExercise(
      bp,
      Enumerable.range(0, bp.sets)
        .select(() => new PotentialSet(tick(bp.repsPerSet), new Weight(kg, 'kilograms')))
        .toArray(),
      undefined,
    );
  }

  it('cuts a flagged lift and leaves an unflagged one alone', () => {
    const service = makeInjuryService({});
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press, squat], ''),
      { [keyed(press)]: recorded(press, 40), [keyed(squat)]: recorded(squat, 100) },
    );
    const [p, s] = session.recordedExercises as RecordedWeightedExercise[];
    expect(p!.potentialSets[0]!.weight.equals(new Weight(20, 'kilograms'))).toBe(true);
    // squat's normal rule applies (progressive overload on success)
    expect(s!.potentialSets[0]!.weight.equals(new Weight(102.5, 'kilograms'))).toBe(true);
  });

  it('appends the rehab block', () => {
    const service = makeInjuryService({});
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press], ''), {},
    );
    expect(session.recordedExercises.filter((x) => x.blueprint.group === REHAB_GROUP))
      .toHaveLength(13);
  });

  it('does nothing when the injury is resolved', () => {
    const service = makeInjuryService({ injury: { status: 'resolved' } });
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press], ''),
      { [keyed(press)]: recorded(press, 40) },
    );
    expect(session.recordedExercises).toHaveLength(1);
    expect((session.recordedExercises[0] as RecordedWeightedExercise)
      .potentialSets[0]!.weight.equals(new Weight(42.5, 'kilograms'))).toBe(true);
  });

  it('respects an override that unflags a lift', () => {
    const service = makeInjuryService({ overrides: { 'standing military press': false } });
    const session = service.hydrateSessionFromBlueprint(
      new SessionBlueprint('Push', [press], ''),
      { [keyed(press)]: recorded(press, 40) },
    );
    expect((session.recordedExercises[0] as RecordedWeightedExercise)
      .potentialSets[0]!.weight.equals(new Weight(42.5, 'kilograms'))).toBe(true);
  });
});
```

`tick(reps)` comes from `@/models/session-models/__test__/helpers`; check its signature there. The 102.5 and 42.5 figures assume `overload()` adds 2.5 on success, as the existing tests do.

- [ ] **Step 2:** Run `npx vitest run src/services/session-service`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** in `createNewSession`:
  1. At the top, read `const injury = selectActiveInjury(this.getState());` and `const overrides = this.getState().injury?.flagOverrides ?? {};`. Then, if `injury`, set `sessionBlueprint = withRehabBlock(sessionBlueprint, injury.structures);`. Rename the parameter or use a local so the reassignment is clear.
  2. Extend `historyFor`'s entries to include `sessionId: session.id`, so its list type matches `InjuryHistoryEntry`. The adjust-by-reps call only reads `date` and `exercise`, so it is unaffected.
  3. At the end of `getNextExercise`, before `return newExercise`:

```ts
      if (
        injury &&
        (e.group === REHAB_GROUP || isShoulderLoaded(e.name, overrides))
      ) {
        const carried = newExercise.potentialSets[0]?.weight ?? new Weight(0, $this.getDefaultWeightUnit());
        const weight = injuryWeight({
          history: historyFor(e),
          onsetDate: LocalDate.parse(injury.onsetDate),
          carried,
          increment: e.progressiveOverload.weightIncrement,
          painLimit: injury.painLimit,
          firstCut: injury.firstCut,
          nextDayAnswers: $this.getState().injury.nextDayAnswers,
        });
        newExercise = newExercise.withAllSets((s) => s.with({ weight }));
      }
```

  A rehab lift with no history has `carried` 0, and the cut of 0 is 0. That is correct for bodyweight work.
  `getState().injury` may be undefined in older test fixtures, so guard every read with `?.`.
- [ ] **Step 4:** Run `npx vitest run src/services && npm run typecheck`. Expected: all PASS, including existing session-service tests.
- [ ] **Step 5:** Commit: `git commit -am "feat: session generation applies injury mode"`

### Task 7: Since-injury bests and archive

**Files:**
- Modify: `app/src/store/stored-sessions/index.ts:336-386`
- Test: `app/src/store/stored-sessions/index.spec.ts`

**Interfaces:**
- Produces: `selectWeightedExercisePersonalBests` keeps its signature but counts only sessions dated on or after the active injury's `onsetDate` when one exists. New export `selectArchivedWeightedExerciseBests(state): { name: string; best: WeightedExercisePersonalBests }[]` returns all-time bests sorted by name, and an empty list when no injury is active.

- [ ] **Step 1: Write the failing tests.** Follow the existing spec file's state-building helper (read the top of `index.spec.ts`). Add an `injury` key to the state with an active injury dated `2026-01-05`, two sessions of `Standing Military Press` (2026-01-01 at 40 kg and 2026-01-11 at 20 kg), and assert:
  - `selectWeightedExercisePersonalBests(state, undefined)(pressBlueprint)?.maxWeight` equals 20 kg.
  - With the injury `resolved`, it equals 40 kg.
  - `selectArchivedWeightedExerciseBests(state)` contains `{ name: 'Standing Military Press', best.maxWeight 40 kg }` when active, and `[]` when resolved.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.** Split the body of `selectAllTimeWeightedExerciseBests` into a plain function `computeBests(sessions, excludeSessionId, since: LocalDate | undefined)` that skips `session.date.isBefore(since)`. Then:

```ts
const selectBestsSince = (state: RootState) => {
  const injury = selectActiveInjury(state);
  return injury ? injury.onsetDate : undefined;
};

const selectAllTimeWeightedExerciseBests = createSelector(
  [
    storedSessionsSlice.selectors.selectSessions,
    (_, excludeSessionId: string | undefined) => excludeSessionId,
    selectBestsSince,
  ],
  (sessions, excludeSessionId, since) =>
    computeBests(sessions, excludeSessionId, since ? LocalDate.parse(since) : undefined),
);

export const selectArchivedWeightedExerciseBests = createSelector(
  [storedSessionsSlice.selectors.selectSessions, selectBestsSince],
  (sessions, since) => {
    if (!since) {
      return [];
    }
    const all = computeBests(sessions, undefined, undefined);
    const names = new Map<string, string>();
    for (const s of sessions) {
      for (const ex of s.recordedExercises) {
        names.set(NormalizedName.fromExerciseBlueprint(ex.blueprint).toString(), ex.blueprint.name);
      }
    }
    return Object.entries(all)
      .filter(([, best]) => best.maxWeight)
      .map(([key, best]) => ({ name: names.get(key) ?? key, best }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
);
```

`selectSessions` may be a Record rather than an array. Mirror whatever the existing loop does (`for (const session of sessions)`).
- [ ] **Step 4:** Run `npx vitest run src/store/stored-sessions && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit: `git commit -am "feat: bests since injury with all-time archive"`

### Task 8: Self-screen logic

**Files:**
- Create: `app/src/models/injury/screen.ts`
- Test: `app/src/models/injury/screen.spec.ts`

**Interfaces:**
- Produces:

```ts
export interface ScreenAnswers {
  traumaWithWeakness: boolean;
  feverOrHotJoint: boolean;
  weightLossOrCancer: boolean;
  painfulArc: boolean | undefined;
  dropArm: boolean | undefined;
  passiveAsLimitedAsActive: boolean | undefined;
  neckSymptoms: boolean | undefined;
  scapularSymptoms: boolean | undefined;
}
export type ScreenOutcome =
  | { kind: 'clinician' }
  | { kind: 'physio' | 'ok'; suggestedStructures: string[] };
export function screenOutcome(a: ScreenAnswers): ScreenOutcome;
```

Rules:
- Any red flag → `clinician`.
- `passiveAsLimitedAsActive`, or (`dropArm` and `painfulArc`), or `neckSymptoms` → `physio`.
- Otherwise → `ok`.
- Suggestions: `painfulArc` → `supraspinatus`. `scapularSymptoms` → `serratus anterior`, `lower trapezius`, `middle trapezius`, `rhomboids`. Neither → `[]`.

- [ ] **Step 1: Write the failing tests.**

```ts
import { describe, it, expect } from 'vitest';
import { screenOutcome, ScreenAnswers } from '@/models/injury/screen';

const clear: ScreenAnswers = {
  traumaWithWeakness: false, feverOrHotJoint: false, weightLossOrCancer: false,
  painfulArc: false, dropArm: false, passiveAsLimitedAsActive: false,
  neckSymptoms: false, scapularSymptoms: false,
};

describe('screenOutcome', () => {
  it.each(['traumaWithWeakness', 'feverOrHotJoint', 'weightLossOrCancer'] as const)(
    '%s sends to a clinician', (flag) => {
      expect(screenOutcome({ ...clear, [flag]: true }).kind).toBe('clinician');
    });

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
    expect(screenOutcome({ ...clear, painfulArc: true, scapularSymptoms: true }))
      .toEqual({
        kind: 'ok',
        suggestedStructures: [
          'supraspinatus', 'serratus anterior', 'lower trapezius', 'middle trapezius', 'rhomboids',
        ],
      });
  });

  it('unanswered checks count as no', () => {
    expect(screenOutcome({ ...clear, painfulArc: undefined, dropArm: undefined }).kind).toBe('ok');
  });
});
```

- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement.**

```ts
// app/src/models/injury/screen.ts
export function screenOutcome(a: ScreenAnswers): ScreenOutcome {
  if (a.traumaWithWeakness || a.feverOrHotJoint || a.weightLossOrCancer) {
    return { kind: 'clinician' };
  }
  const suggestedStructures = [
    ...(a.painfulArc ? ['supraspinatus'] : []),
    ...(a.scapularSymptoms
      ? ['serratus anterior', 'lower trapezius', 'middle trapezius', 'rhomboids']
      : []),
  ];
  const physio =
    a.passiveAsLimitedAsActive === true ||
    (a.dropArm === true && a.painfulArc === true) ||
    a.neckSymptoms === true;
  return { kind: physio ? 'physio' : 'ok', suggestedStructures };
}
```

(Put the `ScreenAnswers` and `ScreenOutcome` types above it, exactly as in Interfaces.)
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `git add src/models/injury/screen* && git commit -m "feat: injury self-screen routing"`

### Task 9: Injury settings and self-screen screens

**Files:**
- Create: `app/src/app/settings/injury/index.tsx` (the Injury mode screen)
- Create: `app/src/app/settings/injury/screen.tsx` (the self-screen flow)
- Modify: `app/src/app/settings/index.tsx`. Add a `List.Item` row "Injury mode" that pushes `/settings/injury`, following the existing rows' pattern in that file.
- Modify: `app/src/i18n/en.json` (keys below)

**Interfaces:**
- Consumes: Task 1 actions and selector, Task 2 `isShoulderLoaded`, Task 8 `screenOutcome`, and the program's session blueprints. Use the existing program selector the stats or program screens use; find it with `grep -rn "selectActiveProgram" src/store/program`.

Behaviour:
- **Injury mode screen.**
  - No injury: a "Start injury mode" button opens the self-screen.
  - Injury present: show name, side, onset date (date field), structures as editable chips, pain limit (stepper 1 to 10), first cut (stepper 10% to 90% in steps of 10), status, "Re-run self-screen", and "Mark resolved".
  - Then a "Shoulder-loaded lifts" section: every distinct weighted exercise name in the active program, each with a switch. Its value is `isShoulderLoaded(name, overrides)`. Toggling dispatches `setFlagOverride({ name: normalized, flagged })`. A long-press resets it to the heuristic (`flagged: undefined`).
  - Reject an onset date in the future: disable Save and show the error text.
- **Self-screen.**
  - One question per page, using react-native-paper `RadioButton` yes/no plus "Not sure" (which maps to `undefined`). Order: the three red flags, then painful arc, drop arm, active vs passive range, neck, scapular symptoms. Each self-check page has a two-line instruction.
  - Every page footer shows the disclaimer key.
  - The result page uses `screenOutcome`:
    - `clinician` shows the clinician text, and its only button is Close; it dispatches nothing.
    - `physio` shows the physio text, a "Continue anyway" button, and suggested structures as pre-selected chips.
    - `ok` shows the suggested chips.
  - The final "Start" dispatches `setInjury({...})`, keeping existing name, onset and side when re-running, or defaulting to name "Shoulder", side "right" and onset today for a new injury. It also sets `screenFindings` with `takenOn` today.

i18n keys to add, in alphabetical order with the file's existing ordering:

```json
"injury.archive.title": "All-time bests",
"injury.clinician.body": "One of your answers can mean something that needs a clinician before any training. See a doctor or physio now.",
"injury.disclaimer": "This is a screen, not a diagnosis. A physio's assessment comes first.",
"injury.first_cut": "First cut",
"injury.flags.title": "Shoulder-loaded lifts",
"injury.mark_resolved": "Mark resolved",
"injury.next_day.question": "Is your shoulder worse than before your last workout?",
"injury.next_day.no": "No",
"injury.next_day.yes": "Worse",
"injury.onset": "Started",
"injury.onset.future": "The start date can't be in the future.",
"injury.pain.question": "Pain during that set?",
"injury.pain.stopped": "Stopped for pain",
"injury.pain_limit": "Pain limit",
"injury.physio.body": "Your answers suggest seeing a physio before loading the shoulder.",
"injury.physio.continue": "Continue anyway",
"injury.rerun_screen": "Re-run self-screen",
"injury.screen.drop_arm": "Raise the arm overhead, then lower it slowly out to the side. Did it drop or give way?",
"injury.screen.fever": "Do you have a fever, or is the joint hot and swollen?",
"injury.screen.neck": "Does the pain change when you move your neck, or do you get pins and needles below the elbow?",
"injury.screen.painful_arc": "Raise the arm slowly out to the side. Does it hurt partway up, roughly 60 to 120 degrees, and ease above that?",
"injury.screen.passive": "Lift the arm with your other hand. Does it go no further than when you lift it on its own?",
"injury.screen.scapular": "Is the pain around or under the shoulder blade, or does the shoulder blade wing or click?",
"injury.screen.trauma": "Did this start with a fall or blow, followed by weakness or sudden inability to lift the arm?",
"injury.screen.weight_loss": "Have you had unexplained weight loss, or a history of cancer?",
"injury.side.left": "Left",
"injury.side.right": "Right",
"injury.start": "Start injury mode",
"injury.structures": "Structures",
"injury.title": "Injury mode",
"settings.injury.subtitle": "Program around an injury",
"settings.injury.title": "Injury mode"
```

Check whether other locale files require the same keys: `ls src/i18n` and check how missing keys behave. If Tolgee falls back to `en`, add to `en.json` only.

- [ ] **Step 1:** Build both screens and the settings row. Mirror the structure and imports of an existing settings sub-screen, for example `app/src/app/settings/notifications.tsx`: `FullHeightScrollView`, `Stack.Screen` with a title, react-native-paper `List`, `Switch`, `Button`, `Chip` and `RadioButton`.
- [ ] **Step 2:** Run `npm run typecheck && npm run lint`. Expected: clean.
- [ ] **Step 3:** Commit: `git add -A src/app/settings src/i18n && git commit -m "feat: injury mode settings and self-screen"`

### Task 10: Pain tap, stopped sets and next-day check

**Files:**
- Create: `app/src/components/presentation/workout/pain-picker-dialog.tsx`
- Create: `app/src/components/smart/next-day-check-dialog.tsx`
- Create: `app/src/models/injury/next-day.ts` and `next-day.spec.ts`
- Modify: `app/src/components/presentation/workout/weighted/weighted-exercise.tsx`
- Modify: `app/src/components/smart/session-component.tsx` (pass the new props)
- Modify: the workout tab screen `app/src/app/(session)/index.tsx` (mount `NextDayCheckDialog`)

**Interfaces:**
- `WeightedExerciseProps` gains `painTracked?: boolean` and `painLimit?: number`.
- `pendingNextDayCheck(args: { sessions: Session[]; injury: Injury | undefined; answers: Record<string, NextDayAnswer>; overrides: Record<string, boolean>; now: OffsetDateTime }): Session | undefined` returns the most recent finished session that:
  - is dated on or after onset,
  - holds a pain-tracked lift (flagged, or in the Rehab group) with a ticked set,
  - has no answer,
  - had its last set completed at least 12 hours before `now`.

- [ ] **Step 1: Write the failing `next-day.spec.ts`.** Cover these cases:
  - A session 13 h old with a ticked flagged lift is returned.
  - The same session 11 h old is not.
  - An answered session is not returned.
  - A session with only unflagged lifts is not returned.
  - No active injury returns `undefined`.

  Build sessions with the helpers used in Task 3's test. Use `OffsetDateTime.parse(...)` for set completion times.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement `next-day.ts`.**

```ts
import { OffsetDateTime, Duration } from '@js-joda/core';
import { Session, RecordedWeightedExercise } from '@/models/session-models';
import { Injury, NextDayAnswer } from '@/models/injury/injury';
import { isShoulderLoaded } from '@/models/injury/flags';
import { REHAB_GROUP } from '@/models/injury/rehab';
import { LocalDate } from '@js-joda/core';

export function pendingNextDayCheck(args: {
  sessions: Session[];
  injury: Injury | undefined;
  answers: Record<string, NextDayAnswer>;
  overrides: Record<string, boolean>;
  now: OffsetDateTime;
}): Session | undefined {
  const { injury } = args;
  if (!injury) {
    return undefined;
  }
  const onset = LocalDate.parse(injury.onsetDate);
  const candidates = args.sessions
    .filter((s) => !s.date.isBefore(onset) && !args.answers[s.id])
    .map((s) => {
      const tracked = s.recordedExercises.filter(
        (x): x is RecordedWeightedExercise =>
          x instanceof RecordedWeightedExercise &&
          (x.blueprint.group === REHAB_GROUP || isShoulderLoaded(x.blueprint.name, args.overrides)) &&
          x.potentialSets.some((p) => p.set),
      );
      const last = tracked
        .flatMap((x) => x.potentialSets.map((p) => p.set?.completionDateTime))
        .filter((t): t is OffsetDateTime => !!t)
        .sort((a, b) => a.compareTo(b))
        .pop();
      return { s, last };
    })
    .filter((x): x is { s: Session; last: OffsetDateTime } =>
      !!x.last && Duration.between(x.last, args.now).toHours() >= 12)
    .sort((a, b) => b.last.compareTo(a.last));
  return candidates[0]?.s;
}
```

- [ ] **Step 4: Pain picker dialog.** A react-native-paper `Portal` + `Dialog` titled with `injury.pain.question`, showing a 0 to 10 row of `ToggleButton`s or `Chip`s, 11 in all, wrapping on narrow screens. Props: `visible`, `onPick(pain: number)` and `onDismiss()`. Dismissing leaves pain undefined. Follow `swap-exercise-dialog.tsx` for the Dialog idiom.
- [ ] **Step 5: Wire it into `weighted-exercise.tsx`.**
  - Find where a set is cycled; it calls `props.updateExercise(recordedExercise.withCycledRepCount(...))`.
  - After a cycle that turns an empty set into a completed one, when `props.painTracked`, store the set index in local state to open the picker. `onPick` calls `props.updateExercise(latest.withSetPain(index, pain))`.
  - Compute `const stoppedAt = props.painTracked && props.painLimit !== undefined ? props.recordedExercise.stoppedForPainAt(props.painLimit) : undefined;`.
  - Sets after `stoppedAt` render disabled. Use the same disabled path as `isReadonly`, applied per set.
  - When `stoppedAt` is defined, add a small label with `injury.pain.stopped` under the exercise title.
- [ ] **Step 6:** In `session-component.tsx`, read `selectActiveInjury` and `state.injury.flagOverrides`. For each weighted exercise, pass `painTracked={!!injury && (ex.blueprint.group === REHAB_GROUP || isShoulderLoaded(ex.blueprint.name, overrides))}` and `painLimit={injury?.painLimit}`.
- [ ] **Step 7: `NextDayCheckDialog`.**
  - Select stored sessions as an array, the injury, answers and overrides.
  - Compute `pendingNextDayCheck` with `OffsetDateTime.now()` inside a `useMemo`, keyed on those inputs.
  - When there is a result, show a Dialog with `injury.next_day.question` and two buttons (`injury.next_day.no` and `injury.next_day.yes`), each dispatching `answerNextDay`.
  - Dismissing without answering hides it until next mount.
  - Mount it in `app/(session)/index.tsx`.
- [ ] **Step 8:** Run `npx vitest run src/models/injury && npm run typecheck && npm run lint`. Expected: clean.
- [ ] **Step 9:** Commit: `git add -A src && git commit -m "feat: pain tap after sets and next-day check"`

### Task 11: Stats archive

**Files:**
- Create: `app/src/components/presentation/stats/archived-bests-card.tsx`
- Modify: `app/src/app/stats/index.tsx` (render it under `MuscleGapsCard`)

- [ ] **Step 1:** Write the card.
  - It uses `useAppSelector(selectArchivedWeightedExerciseBests)` and renders nothing when the list is empty.
  - Otherwise it renders a `TitledSection` (from `components/presentation/stats/titled-section`) titled `injury.archive.title`.
  - It lists one row per exercise: the name, then the max weight via `best.maxWeight.shortLocaleFormat()` and the max reps.
- [ ] **Step 2:** Run `npm run typecheck && npm run lint`. Expected: clean.
- [ ] **Step 3:** Commit: `git add -A src && git commit -m "feat: all-time bests archive while injured"`

### Task 12: Full verification and device check

- [ ] **Step 1:** Run `npm test -- --run && npm run typecheck && npm run lint` in `app/`. Expected: all green. Record the test count. Before Task 1 it was 42 spec files on `origin/main`.
- [ ] **Step 2:** Build and install on the Pixel. These steps come from memory note `liftlog-android-build-install`:
  - `cd android`
  - `./gradlew :app:assembleRelease`
  - `adb install -r app/build/outputs/apk/release/app-release.apk`
  - `-r` updates in place and keeps data. If it fails with `UPDATE_INCOMPATIBLE`, stop and ask. Never uninstall.
- [ ] **Step 3:** Check on the device:
  1. Settings → Injury mode → Start injury mode, then answer no to the red flags and yes to scapular symptoms. Suggested chips show serratus anterior, lower trapezius, middle trapezius and rhomboids.
  2. Start a Push workout. Standing Military Press (or the program's overhead press) is at half its last weight, and a Rehab block sits at the end.
  3. Tick a set, pick 6. The remaining sets disable and "Stopped for pain" appears.
  4. On the Stats tab, "All-time bests" lists the pre-injury figures.
  5. Mark resolved. The next generated workout has no Rehab block, and the archive disappears.
- [ ] **Step 4:** Open a PR. This is a product-facing change. The title is "Injury mode: lighter shoulder lifts, pain checks and rehab", and the body is two plain sentences: what changed for the person using it, then why. Do not name a specific failure. Do not mention AI tools.
