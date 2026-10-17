import { describe, expect, it } from 'vitest';
import { SessionBlueprint } from '@/models/blueprint-models';
import { Instant } from '@js-joda/core';
import {
  PotentialSet,
  RecordedSet,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { SessionUserEvent, SharedSession } from '@/models/feed-models';
import { Weight } from '@/models/weight';
import {
  makeWeightedBlueprint,
  tick,
} from '@/models/session-models/__test__/helpers';
import {
  eventWithoutPain,
  sharedItemWithoutPain,
  withoutPain,
} from '@/models/without-pain';

const t = tick();
const bp = makeWeightedBlueprint();
const kg = new Weight(20, 'kilograms');
const painful = () => {
  const ex = new RecordedWeightedExercise(
    bp,
    [new PotentialSet(new RecordedSet(8, t, 6), kg)],
    undefined,
    true,
  );
  return Session.getEmptySession(
    new SessionBlueprint('x', [bp], ''),
    'kilograms',
  ).with({
    recordedExercises: [ex],
  });
};

describe('withoutPain', () => {
  it('leaves the original alone and strips the copy', () => {
    const s = painful();
    expect(JSON.stringify(withoutPain(s).toJSON())).not.toMatch(/pain/i);
    expect(JSON.stringify(s.toJSON())).toContain('"pain":6');
    expect(JSON.stringify(s.toJSON())).toContain('"stoppedForPain":true');
  });

  it('strips pain from a published feed event payload', () => {
    const e = new SessionUserEvent(
      'u',
      'e',
      Instant.now(),
      Instant.now(),
      painful(),
    );
    expect(JSON.stringify(eventWithoutPain(e).toJSON())).not.toMatch(/pain/i);
  });

  it('strips pain from a shared session payload', () => {
    const item = new SharedSession(painful());
    expect(JSON.stringify(sharedItemWithoutPain(item).toJSON())).not.toMatch(
      /pain/i,
    );
  });
});
