import { describe, it, expect, vi } from 'vitest';
import { addSharedItemEffects } from '@/store/feed/shared-item-effects';
import { encryptAndShare } from '@/store/feed';
import { createAddEffectTestBed } from '@/utils/__test__/add-effect-testbed';
import { RemoteData } from '@/models/remote';
import { SharedSession } from '@/models/feed-models';
import { SessionBlueprint } from '@/models/blueprint-models';
import {
  PotentialSet,
  RecordedSet,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { Weight } from '@/models/weight';
import {
  makeWeightedBlueprint,
  tick,
} from '@/models/session-models/__test__/helpers';

describe('sharing a workout', () => {
  it('sends neither pain ratings nor pain stops', async () => {
    const bp = makeWeightedBlueprint();
    const session = Session.getEmptySession(
      new SessionBlueprint('x', [bp], ''),
      'kilograms',
    ).with({
      recordedExercises: [
        new RecordedWeightedExercise(
          bp,
          [
            new PotentialSet(
              new RecordedSet(8, tick(), 7),
              new Weight(20, 'kilograms'),
            ),
          ],
          undefined,
          true,
        ),
      ],
    });
    let sent: Uint8Array | undefined;
    const bed = createAddEffectTestBed({
      initialState: {
        feed: {
          identity: RemoteData.success({
            id: 'u',
            password: 'p',
            rsaKeyPair: { privateKey: 'k' },
          }),
        },
      },
      services: {
        encryptionService: {
          generateAesKey: vi
            .fn()
            .mockResolvedValue({ value: new Uint8Array() }),
          signRsa256PssAndEncryptAesCbcAsync: vi.fn((bytes: Uint8Array) => {
            sent = bytes;
            return Promise.resolve({ encryptedPayload: new Uint8Array() });
          }),
        },
        feedApiService: {
          postSharedItemAsync: vi
            .fn()
            .mockResolvedValue({ isSuccess: () => false, error: {} }),
        },
      },
    });
    addSharedItemEffects(bed.addEffect);

    await bed.dispatchHandled(
      encryptAndShare({ item: new SharedSession(session), title: 'x' }),
    );

    const json = new TextDecoder().decode(sent);
    expect(json).toContain('"repsCompleted":8');
    expect(json).not.toMatch(/pain/i);
  });
});
