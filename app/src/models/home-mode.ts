import BigNumber from 'bignumber.js';
import {
  IncreaseAllEvenlyProgressiveOverload,
  NormalizedName,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import { PAUSED_BLANK_GROUP, PAUSED_GROUP } from '@/models/injury/paused-group';
import { RecordedWeightedExercise, Session } from '@/models/session-models';
import { isLegDay, SKI_LEGS_DAY } from '@/models/ski-prep';
import { Weight } from '@/models/weight';
import { ExerciseDescriptor } from '@/models/exercise-models';
import { HOME_GROUP } from '@/models/home-group';

export { HOME_GROUP };

/** Home reps never go past this; the note slows the lift down instead. */
export const MAX_HOME_REPS = 20;
const MAX_PROGRESSED_REPS = 25;
const SLOW_NOTE = 'Lower over 3 s, stop one or two reps short of failure.';

export interface HomeLift {
  name: string;
  /** Home loads in kg, heaviest first, per hand for a pair; empty for bodyweight or a band */
  loads: number[];
  notes?: string;
}

const DUMBBELLS = [7.5, 5];
const KETTLEBELL = [12];

/**
 * Matt's home equipment: dumbbells of 7.5 and 5 kg in pairs, a 12 kg
 * kettlebell, a bench, an ab roller, loop bands without handles and no door
 * anchor, a Pilates ring and a balance cushion. No bar and no TRX.
 */
const homeLifts: Record<string, HomeLift | 'gym only'> = {
  // Push
  'Incline Bench Press (Barbell)': {
    name: 'Incline Dumbbell Press',
    loads: DUMBBELLS,
    notes: 'On the bench, inclined.',
  },
  'Decline Bench Press (Barbell)': {
    name: 'Decline Push Up',
    loads: [],
    notes: 'Feet on the bench.',
  },
  'Cable Chest Press': {
    name: 'Band Chest Press',
    loads: [],
    notes: 'Loop across the back.',
  },
  'Cable Fly Crossovers': {
    name: 'Dumbbell Fly',
    loads: DUMBBELLS,
    notes: 'Lying on the bench.',
  },
  'Single Arm Cable Crossover': {
    name: 'Single Arm Band Chest Fly',
    loads: [],
    notes: 'Loop across the back.',
  },
  'Triceps Pushdown - Rope Attachment': {
    name: 'Band Overhead Triceps Extension',
    loads: [],
    notes: 'Loop under the back foot.',
  },
  'Triceps Kickback (Cable)': {
    name: 'Dumbbell Triceps Kickback',
    loads: DUMBBELLS,
  },
  'Seated Triceps Press': {
    name: 'Seated Dumbbell Triceps Press',
    loads: DUMBBELLS,
    notes: 'One dumbbell in both hands.',
  },
  // Pull
  'Cable Rear Delt Fly': {
    name: 'Bent-over Dumbbell Rear Delt Fly',
    loads: DUMBBELLS,
  },
  'Bent Over Barbell Row': {
    name: 'One-arm Kettlebell Row',
    loads: KETTLEBELL,
    notes: 'Free hand on the bench.',
  },
  'Seated Cable Rows': {
    name: 'Seated Band Row',
    loads: [],
    notes: 'Loop round the feet.',
  },
  'Wide-Grip Lat Pulldown': {
    name: 'Overhead Band Pulldown',
    loads: [],
    notes: 'Hold the loop overhead and pull it apart down to the chest.',
  },
  Pullups: 'gym only',
  'Inverted Row': 'gym only',
  // Legs
  'Hack Squat': { name: 'Goblet Squat', loads: KETTLEBELL },
  'Leg Press': {
    name: 'Dumbbell Step-up',
    loads: DUMBBELLS,
    notes: 'Onto the bench.',
  },
  'Hip Thrust (Machine)': {
    name: 'Single-leg Hip Thrust',
    loads: KETTLEBELL,
    notes: 'Shoulders on the bench, kettlebell on the hip.',
  },
  'Lying Leg Curls': {
    name: 'Dumbbell Romanian Deadlift',
    loads: DUMBBELLS,
  },
  'Leg Extensions': {
    name: 'Heel-elevated Goblet Squat',
    loads: KETTLEBELL,
  },
  'Standing Calf Raises': {
    name: 'Single-leg Calf Raise',
    loads: DUMBBELLS,
  },
  'Hanging Leg Raise': {
    name: 'Lying Leg Raise',
    loads: [],
    notes: 'On the bench.',
  },
  'Front Box Jump': { name: 'Tuck Jump', loads: [] },
  'TRX Squat': 'gym only',
  'TRX Suspended Lunge': 'gym only',
  'TRX Hamstring Curl': 'gym only',
  'TRX Pistol Squat': 'gym only',
};

const byKey = new Map(
  Object.entries(homeLifts).map(([k, v]) => [
    new NormalizedName(k).toString(),
    v,
  ]),
);

/** The home version of a gym lift, 'gym only', or undefined to leave it be. */
export function homeLiftFor(
  gymName: string,
): HomeLift | 'gym only' | undefined {
  return byKey.get(new NormalizedName(gymName).toString());
}

/**
 * Every lift home mode can put in a workout. liftlog-garmin-sync's tests read
 * this file to check each one has a Garmin match.
 */
export function homeLiftNames(): string[] {
  return [
    ...Object.values(homeLifts).flatMap((x) =>
      x === 'gym only' ? [] : [x.name],
    ),
    RING_SQUEEZE,
  ];
}

/** The heaviest home load not over the gym weight, else the lightest. */
export function homeLoad(loads: number[], gymKg: number): number {
  if (!loads.length) {
    return 0;
  }
  return loads.find((x) => x <= gymKg) ?? loads.at(-1)!;
}

/**
 * Planned reps scaled by how much lighter the home load is, kept between the
 * planned reps and MAX_HOME_REPS. Bodyweight and band lifts keep their reps.
 */
export function homeReps(planned: number, gymKg: number, homeKg: number) {
  if (homeKg <= 0 || gymKg <= homeKg) {
    return planned;
  }
  return Math.max(
    planned,
    Math.min(MAX_HOME_REPS, Math.round((planned * gymKg) / homeKg)),
  );
}

/**
 * The target after the last time at home: one more rep once every set hit
 * its target, never under what the rule gives.
 */
function progressed(
  ruleReps: number,
  last: RecordedWeightedExercise | undefined,
): number {
  if (!last) {
    return ruleReps;
  }
  const target = last.blueprint.repsPerSet;
  const allHit = last.potentialSets.every(
    (s) => s.set !== undefined && s.set.repsCompleted >= target,
  );
  return Math.max(
    ruleReps,
    allHit ? Math.min(MAX_PROGRESSED_REPS, target + 1) : target,
  );
}

const RING_SQUEEZE = 'Pilates Ring Adductor Squeeze';

function ringSqueeze(): WeightedExerciseBlueprint {
  return new WeightedExerciseBlueprint(
    RING_SQUEEZE,
    3,
    15,
    new IncreaseAllEvenlyProgressiveOverload(BigNumber(0)),
    Rest.short,
    false,
    'Ring between the knees, squeeze and hold 3 s each rep.',
    '',
    HOME_GROUP,
  );
}

/** What home mode changed, so switching it off can put the gym lifts back. */
export interface HomeChange {
  /** Where the lift sits in the workout */
  index: number;
  /** The lift's name in the home workout */
  homeName: string;
  original: RecordedWeightedExercise;
}

function isPlannedLift(x: unknown): x is RecordedWeightedExercise {
  return (
    x instanceof RecordedWeightedExercise && !x.blueprint.group && !x.isStarted
  );
}

/**
 * Turns a workout into its home version: each planned gym lift with a home
 * version becomes it, at the home load and scaled reps; lifts that need the
 * gym are paused, which hides them and lets the workout finish; a Legs day
 * that gained a home lift also gains the Pilates ring squeeze. Grouped blocks
 * and lifts already ticked stay. `lastAtHome` gives a home lift's last
 * recording, for progression.
 */
export function toHomeWorkout(
  session: Session,
  lastAtHome: (
    blueprint: WeightedExerciseBlueprint,
  ) => RecordedWeightedExercise | undefined = () => undefined,
): { session: Session; changes: HomeChange[] } {
  const changes: HomeChange[] = [];
  let swapped = false;
  let out = session;
  session.recordedExercises.forEach((exercise, index) => {
    if (!isPlannedLift(exercise)) {
      return;
    }
    const home = homeLiftFor(exercise.blueprint.name);
    if (home === undefined) {
      return;
    }
    if (home === 'gym only') {
      const blueprint = exercise.blueprint.with({
        group:
          exercise.blueprint.group === '' ? PAUSED_BLANK_GROUP : PAUSED_GROUP,
      });
      out = out.withExercise(index, exercise.with({ blueprint }));
      changes.push({
        index,
        homeName: exercise.blueprint.name,
        original: exercise,
      });
      return;
    }
    const gymKg =
      exercise.potentialSets[0]?.weight
        .convertTo('kilograms')
        .value.toNumber() ?? 0;
    const kg = homeLoad(home.loads, gymKg);
    const named = exercise.blueprint.with({ name: home.name });
    const reps = progressed(
      homeReps(exercise.blueprint.repsPerSet, gymKg, kg),
      lastAtHome(named),
    );
    const notes = [home.notes, reps >= MAX_HOME_REPS ? SLOW_NOTE : undefined]
      .filter(Boolean)
      .join(' ');
    // The load is fixed at home; progression goes by reps, never by weight
    const blueprint = named.with({
      repsPerSet: reps,
      notes,
      link: '',
      progressiveOverload: new IncreaseAllEvenlyProgressiveOverload(
        BigNumber(0),
      ),
    });
    const weight = new Weight(kg, 'kilograms');
    out = out.withExercise(
      index,
      exercise.with({ blueprint }).withAllSets((s) => s.with({ weight })),
    );
    changes.push({ index, homeName: home.name, original: exercise });
    swapped = true;
  });
  if (
    swapped &&
    isLegDay(session.blueprint.name) &&
    session.blueprint.name !== SKI_LEGS_DAY
  ) {
    out = out.withAddedExercise(ringSqueeze(), false);
  }
  return { session: out, changes };
}

/**
 * Puts back the gym lifts home mode replaced, where nothing has been ticked
 * on them, and drops the untouched lifts home mode added.
 */
export function fromHomeWorkout(
  session: Session,
  changes: readonly HomeChange[],
): Session {
  let out = session;
  for (const change of changes) {
    const unticked = (x: unknown) =>
      x instanceof RecordedWeightedExercise &&
      !x.isStarted &&
      x.blueprint.name === change.homeName &&
      x.blueprint.group !== HOME_GROUP;
    const index = unticked(out.recordedExercises[change.index])
      ? change.index
      : out.recordedExercises.findIndex(unticked);
    if (index !== -1) {
      out = out.withExercise(index, change.original);
    }
  }
  for (let i = out.recordedExercises.length - 1; i >= 0; i--) {
    const x = out.recordedExercises[i]!;
    if (x.blueprint.group === HOME_GROUP && !x.isStarted) {
      out = out.withRemovedExercise(i);
    }
  }
  return out;
}

const gymNamesByHomeName = new Map<string, string[]>();
for (const [gym, home] of Object.entries(homeLifts)) {
  if (home !== 'gym only') {
    const key = new NormalizedName(home.name).toString();
    gymNamesByHomeName.set(key, [...(gymNamesByHomeName.get(key) ?? []), gym]);
  }
}

/**
 * The finished workout with each home lift back as the planned gym lift it
 * stood in for, so Finish never offers home lifts to the plan. Works from the
 * plan alone, so it still holds after the app restarts mid-workout and the
 * in-memory record of what home mode changed is gone.
 */
export function undoHomeLifts(
  done: SessionBlueprint,
  planned: SessionBlueprint | undefined,
): SessionBlueprint {
  if (!planned) {
    return done;
  }
  const doneNames = new Set(
    done.exercises.map((x) => new NormalizedName(x.name).toString()),
  );
  const used = new Set<string>();
  return done.with({
    exercises: done.exercises.map((x) => {
      if (!(x instanceof WeightedExerciseBlueprint) || x.group) {
        return x;
      }
      const gymNames = gymNamesByHomeName.get(
        new NormalizedName(x.name).toString(),
      );
      const gym = planned.exercises.find((p) => {
        const key = new NormalizedName(p.name).toString();
        return (
          !used.has(key) &&
          !doneNames.has(key) &&
          gymNames?.some((g) => new NormalizedName(g).toString() === key)
        );
      });
      if (!gym) {
        return x;
      }
      used.add(new NormalizedName(gym.name).toString());
      return gym;
    }),
  });
}

/** The switch shows until a planned lift, gym or home, has a set ticked. */
export function canSwitchHome(session: Session): boolean {
  return !session.recordedExercises.some(
    (x) =>
      x instanceof RecordedWeightedExercise &&
      !x.blueprint.group &&
      x.isStarted,
  );
}

type Muscle = ExerciseDescriptor['muscles'][number];

function entry(
  name: string,
  equipment: string,
  force: ExerciseDescriptor['force'],
  mechanic: ExerciseDescriptor['mechanic'],
  muscles: Muscle[],
  instructions: string,
): ExerciseDescriptor {
  return {
    name,
    force,
    level: 'beginner',
    mechanic,
    equipment,
    muscles,
    instructions,
    category: 'strength',
  };
}

/** Library entries for the home lifts the bundled library does not have. */
export function homeDescriptors(): ExerciseDescriptor[] {
  return [
    entry(
      'Decline Push Up',
      'body only',
      'push',
      'compound',
      ['chest', 'shoulders', 'triceps'],
      'Feet on the bench, hands on the floor, lower the chest and push back up.',
    ),
    entry(
      'Band Chest Press',
      'bands',
      'push',
      'compound',
      ['chest', 'shoulders', 'triceps'],
      'Loop across the upper back, a hand in each end, press forward to straight arms.',
    ),
    entry(
      'Dumbbell Fly',
      'dumbbell',
      'push',
      'isolation',
      ['chest', 'shoulders'],
      'Lying on the bench, open the arms wide with a slight bend, then bring the dumbbells together over the chest.',
    ),
    entry(
      'Single Arm Band Chest Fly',
      'bands',
      'push',
      'isolation',
      ['chest', 'shoulders'],
      'Loop across the upper back, sweep one hand across the body to the midline and back.',
    ),
    entry(
      'Band Overhead Triceps Extension',
      'bands',
      'push',
      'isolation',
      ['triceps'],
      'Loop under the back foot, hands behind the head, straighten the arms overhead.',
    ),
    entry(
      'Dumbbell Triceps Kickback',
      'dumbbell',
      'push',
      'isolation',
      ['triceps'],
      'Hinged forward, upper arm by the side, straighten the elbow to push the dumbbell back.',
    ),
    entry(
      'Seated Dumbbell Triceps Press',
      'dumbbell',
      'push',
      'isolation',
      ['triceps'],
      'Seated, one dumbbell in both hands overhead, lower it behind the head and straighten the arms.',
    ),
    entry(
      'Bent-over Dumbbell Rear Delt Fly',
      'dumbbell',
      'pull',
      'isolation',
      ['shoulders', 'middle back', 'traps'],
      'Hinged forward, raise the dumbbells out to the sides with a slight bend in the elbows.',
    ),
    entry(
      'Seated Band Row',
      'bands',
      'pull',
      'compound',
      ['middle back', 'lats', 'biceps'],
      'Seated with legs straight, loop round the feet, row the hands to the ribs.',
    ),
    entry(
      'Overhead Band Pulldown',
      'bands',
      'pull',
      'compound',
      ['lats', 'middle back', 'shoulders'],
      'Hold the loop overhead with straight arms, pull it apart and down to the chest.',
    ),
    entry(
      'Dumbbell Step-up',
      'dumbbell',
      'push',
      'compound',
      ['quadriceps', 'glutes', 'hamstrings'],
      'A dumbbell in each hand, step onto the bench and stand tall, then step down.',
    ),
    entry(
      'Single-leg Hip Thrust',
      'kettlebells',
      'push',
      'compound',
      ['glutes', 'hamstrings'],
      'Shoulders on the bench, kettlebell on the hip, one foot down, drive the hips up.',
    ),
    entry(
      'Dumbbell Romanian Deadlift',
      'dumbbell',
      'pull',
      'compound',
      ['hamstrings', 'glutes', 'lower back'],
      'Soft knees, hinge at the hips with the dumbbells close to the legs, then stand up.',
    ),
    entry(
      'Heel-elevated Goblet Squat',
      'kettlebells',
      'push',
      'compound',
      ['quadriceps', 'glutes'],
      'Heels raised on a plate or book, kettlebell at the chest, squat deep with the knees forward.',
    ),
    entry(
      'Single-leg Calf Raise',
      'dumbbell',
      'push',
      'isolation',
      ['calves'],
      'On one foot, dumbbell in the same hand, rise onto the toes and lower slowly.',
    ),
    entry(
      'Lying Leg Raise',
      'body only',
      'pull',
      'isolation',
      ['abdominals'],
      'Lying on the bench, legs straight, raise them to vertical and lower without touching down.',
    ),
    entry(
      'Tuck Jump',
      'body only',
      'push',
      'compound',
      ['quadriceps', 'glutes', 'calves'],
      'Jump straight up and pull the knees to the chest, land softly.',
    ),
    entry(
      RING_SQUEEZE,
      'other',
      'push',
      'isolation',
      ['adductors'],
      'Seated or lying, Pilates ring between the knees, squeeze and hold.',
    ),
  ];
}
