import {
  KeyedExerciseBlueprint,
  NormalizedName,
  SessionBlueprint,
  ExerciseBlueprint,
  CardioExerciseBlueprint,
  WeightedExerciseBlueprint,
  AdjustByRepsProgressiveOverload,
} from '@/models/blueprint-models';
import { adjustByRepsWeight } from '@/models/adjust-by-reps';
import {
  rolledOverExercises,
  withRolledOverExercises,
} from '@/models/roll-over';
import { Weight, WeightUnit } from '@/models/weight';
import {
  EmptySession,
  PotentialSet,
  RecordedCardioExercise,
  RecordedCardioExerciseSet,
  RecordedExercise,
  RecordedWeightedExercise,
  Session,
} from '@/models/session-models';
import { ProgressRepository } from '@/services/progress-repository';
import type { RootState } from '@/store';
import { uuid } from '@/utils/uuid';
import { LocalDate } from '@js-joda/core';

export class SessionService {
  constructor(
    private progressRepository: ProgressRepository,
    private getState: () => RootState,
  ) {}

  async *getUpcomingSessions(
    sessionBlueprints: SessionBlueprint[],
    latestExercises: Record<string, RecordedExercise | undefined>, // KeyedExerciseBlueprint -> Exercise
  ): AsyncIterableIterator<Session> {
    const currentState = this.getState();
    const currentSession = currentState.currentSession.workoutSession;

    const firstSessionBlueprint = sessionBlueprints[0];
    if (!firstSessionBlueprint) {
      return;
    }
    await yieldToEventLoop();

    let latestSession =
      currentSession ??
      this.progressRepository
        .getOrderedSessions()
        .firstOrDefault((x) => !x.isFreeform);

    await yieldToEventLoop();
    if (!latestSession) {
      latestSession = this.createNewSession(
        firstSessionBlueprint,
        latestExercises,
      );
      yield latestSession;
    }

    // Lifts left untouched in the last finished workout carry into the next
    // one only. An in-progress workout is not finished, so nothing rolls yet.
    let rollOver = currentSession ? [] : rolledOverExercises(latestSession);
    while (true) {
      latestSession = this.getNextSession(
        latestSession,
        sessionBlueprints,
        latestExercises,
        rollOver,
      );
      rollOver = [];
      yield latestSession;
    }
  }

  public hydrateSessionFromBlueprint(
    blueprint: SessionBlueprint,
    latestExercises: Record<string, RecordedExercise | undefined>, // KeyedExerciseBlueprint -> Exercise
  ): Session {
    return this.createNewSession(blueprint, latestExercises);
  }

  private getNextSession(
    previousSession: Session,
    sessionBlueprints: SessionBlueprint[],
    latestRecordedExercises: Record<
      string, //KeyedExerciseBlueprint,
      RecordedExercise | undefined
    >,
    rollOver: readonly WeightedExerciseBlueprint[],
  ): Session {
    const lastBlueprint = previousSession.blueprint;
    const lastBlueprintIndex = sessionBlueprints.findIndex(
      (x) => x.name === lastBlueprint.name,
    );
    const nextBlueprint =
      sessionBlueprints[(lastBlueprintIndex + 1) % sessionBlueprints.length];
    if (!nextBlueprint) {
      return EmptySession.with({ id: uuid() });
    }

    return this.createNewSession(
      withRolledOverExercises(nextBlueprint, rollOver),
      latestRecordedExercises,
    ).with({
      bodyweight: previousSession.bodyweight,
    });
  }

  private createNewSession(
    sessionBlueprint: SessionBlueprint,
    latestRecordedExercises: Record<
      string, //KeyedExerciseBlueprint,
      RecordedExercise | undefined
    >,
  ): Session {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const $this = this;

    // Fallback lookup so the previous weight carries forward by *movement* even
    // when the rep scheme (sets/reps) changed - the strict key above is
    // `name_sets_reps`, so changing the reps of an exercise would otherwise
    // reset its weight to 0. We derive this from the same map the strict lookup
    // uses (its values are the most-recent recording per strict key), grouping
    // by normalized exercise name and keeping the most recently recorded one.
    const latestWeightedByName = new Map<string, RecordedWeightedExercise>();
    for (const ex of Object.values(latestRecordedExercises)) {
      if (!(ex instanceof RecordedWeightedExercise)) {
        continue;
      }
      const nameKey = NormalizedName.fromExerciseBlueprint(ex.blueprint).toString();
      const existing = latestWeightedByName.get(nameKey);
      const existingTime = existing?.latestTime;
      if (
        !existing ||
        (ex.latestTime && (!existingTime || existingTime.isBefore(ex.latestTime)))
      ) {
        latestWeightedByName.set(nameKey, ex);
      }
    }

    // History by movement for lifts that adjust by reps, built once and only
    // when one is present - it reads every stored workout.
    let historyByName:
      | Map<string, { date: LocalDate; exercise: RecordedWeightedExercise }[]>
      | undefined;
    const historyFor = (e: WeightedExerciseBlueprint) => {
      if (!historyByName) {
        historyByName = new Map();
        for (const session of $this.progressRepository.getOrderedSessions()) {
          for (const ex of session.recordedExercises) {
            if (!(ex instanceof RecordedWeightedExercise)) {
              continue;
            }
            const key = NormalizedName.fromExerciseBlueprint(
              ex.blueprint,
            ).toString();
            const list = historyByName.get(key) ?? [];
            list.push({ date: session.date, exercise: ex });
            historyByName.set(key, list);
          }
        }
      }
      return (
        historyByName.get(NormalizedName.fromExerciseBlueprint(e).toString()) ??
        []
      );
    };

    function getNextExercise(e: ExerciseBlueprint): RecordedExercise {
      const lastExercise =
        latestRecordedExercises[
          KeyedExerciseBlueprint.fromExerciseBlueprint(e).toString()
        ];
      if (e instanceof CardioExerciseBlueprint) {
        const cardioLastExercise =
          lastExercise instanceof RecordedCardioExercise
            ? lastExercise
            : undefined;
        return RecordedCardioExercise.empty(e).with({
          sets: e.sets.map((s, i) =>
            RecordedCardioExerciseSet.empty(s).with({
              incline: cardioLastExercise?.sets[i]?.incline,
              resistance: cardioLastExercise?.sets[i]?.resistance,
            }),
          ),
        });
      }
      // Prefer an exact match (same name + sets + reps, preserving per-set
      // weights); otherwise fall back to the latest recording of this movement.
      const exactMatch =
        lastExercise instanceof RecordedWeightedExercise
          ? lastExercise
          : undefined;
      const weightSource =
        exactMatch ??
        latestWeightedByName.get(
          NormalizedName.fromExerciseBlueprint(e).toString(),
        );
      const sourceSets = weightSource?.potentialSets ?? [];
      const potentialSets: PotentialSet[] = sourceSets.length
        ? Array.from(
            { length: e.sets },
            (_, i) =>
              new PotentialSet(
                undefined,
                (sourceSets[i] ?? sourceSets[sourceSets.length - 1]!).weight,
              ),
          )
        : Array.from(
            { length: e.sets },
            () =>
              new PotentialSet(
                undefined,
                new Weight(0, $this.getDefaultWeightUnit()),
              ),
          );
      let newExercise = new RecordedWeightedExercise(
        e,
        potentialSets,
        undefined,
      );
      // Only auto-apply progressive overload for an exact-scheme match, so a
      // renamed/re-repped fallback just seeds the weight without bumping it.
      if (exactMatch?.isSuccessForProgressiveOverload) {
        newExercise =
          newExercise.blueprint.progressiveOverload.applyProgressiveOverload(
            newExercise,
          );
      }
      if (e.progressiveOverload instanceof AdjustByRepsProgressiveOverload) {
        const weight = adjustByRepsWeight({
          history: historyFor(e),
          today: LocalDate.now(),
          increment: e.progressiveOverload.weightIncrement,
        });
        if (weight) {
          newExercise = newExercise.withAllSets((s) => s.with({ weight }));
        }
      }

      return newExercise;
    }
    return new Session(
      uuid(),
      sessionBlueprint,
      sessionBlueprint.exercises.map(getNextExercise),
      LocalDate.now(),
      undefined,
      undefined,
    );
  }

  private getDefaultWeightUnit(): WeightUnit {
    return this.getState().settings.useImperialUnits ? 'pounds' : 'kilograms';
  }
}

// Helper function to yield control back to the event loop
const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 5));
