import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import {
  CardioExerciseBlueprint,
  IncreaseAllEvenlyProgressiveOverload,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  PAUSED_GROUP,
  REHAB_GROUP,
  groupFromInput,
  rehabExercises,
  rehabIncrement,
  withPullLiftsPaused,
  withRehabBlock,
} from '@/models/injury/rehab';
import { ROLLED_OVER_GROUP } from '@/models/roll-over';

const press = new WeightedExerciseBlueprint(
  'Standing Military Press',
  3,
  8,
  new IncreaseAllEvenlyProgressiveOverload(BigNumber(2.5)),
  Rest.medium,
  false,
  '',
  '',
);
const push = new SessionBlueprint('Push', [press], '');

function lift(name: string, group?: string) {
  return press.with({ name, group });
}
const warmUp = new CardioExerciseBlueprint(
  'Warm Up',
  CardioExerciseBlueprint.empty().sets,
  '',
  '',
);

describe('rehab block', () => {
  it('has the 13 sourced exercises', () => {
    expect(rehabExercises).toHaveLength(13);
  });

  it('goes after the mobility block and warm-up, before the first main lift', () => {
    const pull = new SessionBlueprint(
      'Pull',
      [
        lift('Pigeon', 'Mobility'),
        warmUp,
        lift('Pullups'),
        lift('Seated Cable Rows'),
      ],
      '',
    );
    const names = withRehabBlock(pull, ['serratus anterior']).exercises.map(
      (x) => x.name,
    );
    expect(names).toEqual([
      'Pigeon',
      'Warm Up',
      'Push-up plus, elbows',
      'Supine punch',
      'Wall slide',
      'Cross-body posterior shoulder stretch',
      'Pullups',
      'Seated Cable Rows',
    ]);
  });

  it('goes before lifts rolled over from the last workout', () => {
    const pull = new SessionBlueprint(
      'Pull',
      [
        lift('Pigeon', 'Mobility'),
        lift('Curl', ROLLED_OVER_GROUP),
        lift('Pullups'),
      ],
      '',
    );
    const out = withRehabBlock(pull, ['serratus anterior']).exercises;
    expect(out[0]!.name).toBe('Pigeon');
    expect(out[1]!.group).toBe(REHAB_GROUP);
    expect(out.at(-2)!.name).toBe('Curl');
  });

  it('adds exercises matching the structures, plus the stretch, above the first lift', () => {
    const out = withRehabBlock(push, ['serratus anterior']);
    const names = out.exercises.slice(0, -1).map((x) => x.name);
    expect(out.exercises.at(-1)).toBe(press);
    expect(names).toEqual([
      'Push-up plus, elbows',
      'Supine punch',
      'Wall slide',
      'Cross-body posterior shoulder stretch',
    ]);
    expect(
      out.exercises.slice(0, -1).every((x) => x.group === REHAB_GROUP),
    ).toBe(true);
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
  it('steps dumbbell lifts by 1 kg and leaves bodyweight and band lifts manual', () => {
    const out = withRehabBlock(push, []).exercises.slice(0, -1);
    for (const x of rehabExercises) {
      const bp = out.find(
        (b) => b.name === x.name,
      ) as WeightedExerciseBlueprint;
      const expected = x.equipment === 'dumbbell' ? 1 : 0;
      expect(x.increment).toBe(expected);
      expect(rehabIncrement(bp).toNumber()).toBe(expected);
    }
  });
});

describe('groupFromInput', () => {
  it('keeps the reserved id when the rehab label is typed back', () => {
    expect(groupFromInput('Rehab', true, 'Rehab')).toBe(REHAB_GROUP);
  });

  it('makes an ordinary group of any other text', () => {
    expect(groupFromInput('Rehabs', true, 'Rehab')).toBe('Rehabs');
  });

  it('leaves a group the user named Rehab as plain text', () => {
    expect(groupFromInput('Rehab', false, 'Rehab')).toBe('Rehab');
  });
});

describe('withPullLiftsPaused', () => {
  const pull = new SessionBlueprint(
    'Pull',
    [
      lift('Bird Dog', 'Mobility'),
      warmUp,
      lift('Isometric abduction, wall', REHAB_GROUP),
      lift('Band Pull Apart'),
      lift('Cable Rear Delt Fly'),
      lift('Pullups'),
      lift('Inverted Row'),
      lift('Wide-Grip Lat Pulldown'),
      lift('Seated Cable Rows'),
      lift('Dumbbell Bicep Curl'),
      lift('Standing Biceps Stretch'),
      lift('Hack Squat'),
      lift('Curl', ROLLED_OVER_GROUP),
    ],
    '',
  );
  const pausedNames = (bp: SessionBlueprint) =>
    bp.exercises.filter((x) => x.group === PAUSED_GROUP).map((x) => x.name);

  it('pauses lifts that repeat the rehab or load the arm overhead, in place', () => {
    const out = withPullLiftsPaused(pull, {});
    expect(pausedNames(out)).toEqual([
      'Band Pull Apart',
      'Cable Rear Delt Fly',
      'Pullups',
      'Inverted Row',
      'Wide-Grip Lat Pulldown',
      'Seated Cable Rows',
    ]);
    expect(out.exercises.map((x) => x.name)).toEqual(
      pull.exercises.map((x) => x.name),
    );
  });

  it('keeps curls, stretches and lifts away from the shoulder', () => {
    const kept = withPullLiftsPaused(pull, {}).exercises.filter(
      (x) => x.group !== PAUSED_GROUP,
    );
    expect(kept.map((x) => x.name)).toEqual(
      expect.arrayContaining([
        'Dumbbell Bicep Curl',
        'Standing Biceps Stretch',
        'Hack Squat',
        'Curl',
      ]),
    );
  });

  it('keeps a lift the user switched off in the injury settings', () => {
    expect(
      pausedNames(withPullLiftsPaused(pull, { pullup: false })),
    ).not.toContain('Pullups');
  });

  it('leaves other workouts alone', () => {
    const other = pull.with({ name: 'Push' });
    expect(withPullLiftsPaused(other, {})).toBe(other);
  });

  it('matches a pull day by word, not by substring', () => {
    expect(
      pausedNames(withPullLiftsPaused(pull.with({ name: 'Pullover day' }), {})),
    ).toEqual([]);
    expect(
      pausedNames(withPullLiftsPaused(pull.with({ name: 'Upper pull' }), {})),
    ).toContain('Pullups');
  });
});
