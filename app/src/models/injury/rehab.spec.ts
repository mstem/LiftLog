import { describe, it, expect } from 'vitest';
import BigNumber from 'bignumber.js';
import {
  IncreaseAllEvenlyProgressiveOverload,
  Rest,
  SessionBlueprint,
  WeightedExerciseBlueprint,
} from '@/models/blueprint-models';
import {
  REHAB_GROUP,
  groupFromInput,
  rehabExercises,
  rehabIncrement,
  withRehabBlock,
} from '@/models/injury/rehab';

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
    expect(out.exercises.slice(1).every((x) => x.group === REHAB_GROUP)).toBe(
      true,
    );
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
    const out = withRehabBlock(push, []).exercises.slice(1);
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
