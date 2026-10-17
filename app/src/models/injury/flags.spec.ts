import { describe, it, expect } from 'vitest';
import { NormalizedName } from '@/models/blueprint-models';
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

  // A full Push/Pull/Legs plan, sorted by whether the lift loads the shoulder.
  it.each([
    'Push Up',
    'Incline Bench Press (Barbell)',
    'Cable Chest Press',
    'Decline Bench Press (Barbell)',
    'Cable Fly Crossovers',
    'Single Arm Cable Crossover',
    'Seated Triceps Press',
    'Band Pull Apart',
    'Cable Rear Delt Fly',
    'Pullups',
    'Inverted Row',
    'Wide-Grip Lat Pulldown',
    'Bent Over Barbell Row',
    'Seated Cable Rows',
    'Standing Biceps Stretch',
    'Hanging Leg Raise',
    'Dumbbell Bicep Curl',
    'Seated Biceps',
    'Ab Wheel',
    'Ab Roller',
    'Bird Dog',
    'Dumbbell Shoulder Press',
    'Dumbbell Shrug',
    'Face Pull',
    'Shoulder Raise',
    'Barbell Squat',
    'Barbell Curl',
  ])('flags %s', (name) => {
    expect(isShoulderLoaded(name, {})).toBe(true);
  });

  it.each([
    'Leg Press',
    'Hack Squat',
    'Hip Thrust (Machine)',
    'Lying Leg Curls',
    'Leg Extensions',
    'Bulgarian Split Squat',
    'Standing Calf Raises',
    'Dumbbell Lunges',
    'Squat Jump',
    'Seated Palms Up Wrist Curl',
    'Glute Bridge',
    'Triceps Pushdown - Rope Attachment',
    'Triceps Kickback (Cable)',
    'Pigeon',
    '90 90s',
  ])('does not flag %s', (name) => {
    expect(isShoulderLoaded(name, {})).toBe(false);
  });

  it('honours an override either way', () => {
    expect(
      isShoulderLoaded('Barbell Squat', {
        [new NormalizedName('Barbell Squat').toString()]: true,
      }),
    ).toBe(true);
    expect(
      isShoulderLoaded('Standing Military Press', {
        [new NormalizedName('Standing Military Press').toString()]: false,
      }),
    ).toBe(false);
  });
});
