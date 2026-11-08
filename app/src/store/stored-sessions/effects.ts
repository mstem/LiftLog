import { AddEffectFn } from '@/store/store';
import {
  addStoredSession,
  checkIfWeightMigrationRequired,
  deleteExercise,
  deleteStoredSession,
  initializeStoredSessionsStateSlice,
  migrateExerciseWeights,
  refreshMonthlyReportNotification,
  renameExercise,
  selectSessions,
  setAllExerciseNotes,
  setExerciseNotes,
  setExercises,
  setExercisesRequiringWeightMigration,
  setIsHydrated,
  setStoredSessions,
  updateExercise,
  upsertExerciseNotes,
  upsertStoredSessions,
  WeightMigrateableExercise,
} from './index';
import {
  fetchUpcomingSessions,
  setIsHydrated as setProgramIsHydrated,
  upsertSavedPlans,
} from '@/store/program';
import { pendingLibraryRenames } from '@/models/library-renames';
import { ProgramBlueprint } from '@/models/blueprint-models';
import {
  renameInProgram,
  renameInSession,
  renameInSessionBlueprint,
  renameInSwaps,
} from '@/models/rename-exercise';
import { setEditingSession } from '@/store/session-editor';
import { setStatsIsDirty } from '@/store/stats';
import { setFlagOverride, setReturnOverride } from '@/store/injury';
import { SessionTarget } from '@/store/current-session';
import { setMonthlyReportNotifications } from '@/store/settings';
import { LocalDate, YearMonth } from '@js-joda/core';
import { monthlyReport } from '@/models/monthly-report';
import { monthlyReportDeliveryTime } from '@/models/monthly-report-schedule';
import Enumerable from 'linq';
import { RecordedWeightedExercise, Session } from '@/models/session-models';
import {
  setCurrentSession,
  setExerciseSwaps,
  setIsHydrated as setCurrentSessionIsHydrated,
} from '@/store/current-session';
import {
  exerciseNotesSchema,
  exercisesSchema,
  sessionsSchema,
} from '@/db/schema';
import { NormalizedName } from '@/models/blueprint-models';
import { rehabDescriptors } from '@/models/injury/rehab';
import { eq, sql } from 'drizzle-orm';
import { toRecord } from '@/utils/reduce';
import {
  ExerciseDescriptor,
  fromExerciseDescriptorJSON,
  toExerciseDescriptorJSON,
} from '@/models/exercise-models';

// We keep track of added builting exerciseIds (which are the exercise name for builtins)
// Then we make sure builtins don't get re-added if they are deleted
const addedBuiltInExerciseIdsStorageKey = 'AddedBuiltInExerciseIdList';
const libraryRenamesDoneKey = 'LibraryRenamesDone';
export function applyStoredSessionsEffects(addEffect: AddEffectFn) {
  // Dispatched AFTER settings, so we can safely access settings
  addEffect(
    initializeStoredSessionsStateSlice,
    async (
      _,
      {
        cancelActiveListeners,
        getState,
        dispatch,
        extra: { keyValueStore, db, logger },
      },
    ) => {
      cancelActiveListeners();
      if (!getState().settings.isHydrated) {
        throw new Error('Settings must be hydrated before stored sessions');
      }
      await logger.time('initializeStoredSessions', async () => {
        const completedSessions = (
          await db.select().from(sessionsSchema)
        ).reduce(
          toRecord(
            (x) => x.id,
            (row) => Session.fromJSON(row.payload),
          ),
          {},
        );
        dispatch(setStoredSessions(completedSessions));
      });

      const { exercises: builtInExerciseList } =
        await import('../../../assets/exercises.json');
      const builtinExercisesAddedInThePast = JSON.parse(
        (await keyValueStore.getItem(addedBuiltInExerciseIdsStorageKey)) ??
          '[]',
      ) as string[];
      const savedExercises = (await db.select().from(exercisesSchema)).reduce(
        toRecord(
          (x) => x.id,
          (x) => fromExerciseDescriptorJSON(x.payload),
        ),
        {},
      );
      const builtInExercisesNotAlreadyAdded = builtInExerciseList
        .filter((x) => !builtinExercisesAddedInThePast.includes(x.name))
        .reduce(
          (a, b) => {
            a[b.name] = {
              name: b.name,
              force: b.force,
              level: b.level,
              mechanic: b.mechanic,
              equipment: b.equipment,
              category: b.category,
              instructions: b.instructions.join('\n'),
              muscles: b.primaryMuscles.concat(b.secondaryMuscles),
            };
            return a;
          },
          {} as Record<string, ExerciseDescriptor>,
        );

      const knownExerciseNames = new Set(
        [
          ...Object.values(savedExercises),
          ...Object.values(builtInExercisesNotAlreadyAdded),
        ].map((x) => x.name.toLowerCase()),
      );
      for (const rehab of rehabDescriptors()) {
        if (
          !knownExerciseNames.has(rehab.name.toLowerCase()) &&
          !builtinExercisesAddedInThePast.includes(rehab.name)
        ) {
          builtInExercisesNotAlreadyAdded[rehab.name] = rehab;
        }
      }

      const currentExercises = Object.entries({
        ...builtInExercisesNotAlreadyAdded,
        ...savedExercises,
      }).sort((a, b) => a[1].name.localeCompare(b[1].name));

      Object.entries(builtInExercisesNotAlreadyAdded).forEach(([id, ex]) => {
        dispatch(updateExercise({ id, exercise: ex }));
      });

      dispatch(setExercises(Object.fromEntries(currentExercises)));

      const exerciseNotes = (
        await db.select().from(exerciseNotesSchema)
      ).reduce(
        toRecord(
          (x) => x.id,
          (x) => x.notes,
        ),
        {},
      );
      dispatch(setAllExerciseNotes(exerciseNotes));

      const newBuiltIns: string[] = builtinExercisesAddedInThePast.concat(
        Object.keys(builtInExercisesNotAlreadyAdded),
      );
      await keyValueStore.setItem(
        addedBuiltInExerciseIdsStorageKey,
        JSON.stringify(newBuiltIns),
      );

      dispatch(checkIfWeightMigrationRequired());

      dispatch(setIsHydrated(true));
      dispatch(fetchUpcomingSessions());
    },
  );

  addEffect(
    checkIfWeightMigrationRequired,
    (_, { dispatch, stateAfterReduce }) => {
      const completedSessionsList = selectSessions(stateAfterReduce);

      const weightsNeedMigration = Enumerable.from(completedSessionsList)
        .selectMany((x) =>
          Enumerable.from(x.recordedExercises)
            .ofType<RecordedWeightedExercise>(RecordedWeightedExercise)
            .selectMany((ex) =>
              Enumerable.from(ex.potentialSets)
                .where((set) => set.weight.unit === 'nil')
                .select(() => ex)
                .take(1),
            ),
        )
        .select(
          (ex) =>
            ({
              name: ex.blueprint.name,
              unit: 'nil',
            }) satisfies WeightMigrateableExercise,
        )
        .distinct((x) => x.name)
        .orderBy((x) => x.name)
        .toArray();
      dispatch(setExercisesRequiringWeightMigration(weightsNeedMigration));
    },
  );

  addEffect(migrateExerciseWeights, (_, { dispatch, stateAfterReduce }) => {
    const sessions = selectSessions(stateAfterReduce);
    const migrations =
      stateAfterReduce.storedSessions.exercisesRequiringWeightMigration;
    const findUnit = (exerciseName: string) =>
      migrations.find((x) => x.name === exerciseName)?.unit;
    const applyWeightToSession = (session: Session) =>
      session.with({
        recordedExercises: session.recordedExercises.map((re) =>
          re instanceof RecordedWeightedExercise
            ? re.with({
                potentialSets: re.potentialSets.map((ps) =>
                  ps.with({
                    weight: ps.weight.with({
                      unit:
                        ps.weight.unit === 'nil'
                          ? (findUnit(re.blueprint.name) ?? 'nil')
                          : ps.weight.unit,
                    }),
                  }),
                ),
              })
            : re,
        ),
      });
    const newSessions = sessions.map(applyWeightToSession);
    const currentSession = stateAfterReduce.currentSession.workoutSession;
    if (currentSession) {
      dispatch(
        setCurrentSession({
          target: 'workoutSession',
          session: applyWeightToSession(currentSession),
        }),
      );
    }
    dispatch(upsertStoredSessions(newSessions));
    dispatch(fetchUpcomingSessions());
    dispatch(setExercisesRequiringWeightMigration([]));
  });

  // Old library names fold into their new ones once history, plans and the
  // workout in progress have all loaded, so the rename reaches each of them
  let libraryRenamesChecked = false;
  addEffect(
    [setIsHydrated, setProgramIsHydrated, setCurrentSessionIsHydrated],
    async (_, { dispatch, stateAfterReduce, extra: { keyValueStore } }) => {
      if (
        libraryRenamesChecked ||
        !stateAfterReduce.storedSessions.isHydrated ||
        !stateAfterReduce.program.isHydrated ||
        !stateAfterReduce.currentSession.isHydrated
      ) {
        return;
      }
      libraryRenamesChecked = true;
      // Once only: a lift given an old name later is the user's own choice
      if ((await keyValueStore.getItem(libraryRenamesDoneKey)) === '1') {
        return;
      }
      const names = [
        ...Object.values(stateAfterReduce.storedSessions.savedExercises).map(
          (x) => x.name,
        ),
        ...Object.values(stateAfterReduce.storedSessions.sessions).flatMap(
          (x) => [
            ...x.blueprint.exercises.map((e) => e.name),
            ...x.recordedExercises.map((e) => e.blueprint.name),
          ],
        ),
        ...Object.keys(stateAfterReduce.storedSessions.exerciseNotes),
        ...(stateAfterReduce.currentSession.workoutSession?.recordedExercises.map(
          (e) => e.blueprint.name,
        ) ?? []),
        ...Object.values(stateAfterReduce.program.savedPrograms).flatMap((x) =>
          ProgramBlueprint.fromPOJO(x).sessions.flatMap((s) =>
            s.exercises.map((e) => e.name),
          ),
        ),
      ];
      for (const rename of pendingLibraryRenames(names)) {
        dispatch(renameExercise(rename));
      }
      await keyValueStore.setItem(libraryRenamesDoneKey, '1');
    },
  );

  addEffect(renameExercise, (action, { dispatch, stateAfterReduce }) => {
    const rename = action.payload;
    const from = new NormalizedName(rename.from);
    const to = new NormalizedName(rename.to);
    if (!rename.to.trim() || rename.to === rename.from) {
      return;
    }
    // Only capitals or a plural changed: notes and history keys stay put
    const sameKey = from.equals(to);

    const renamedSessions = selectSessions(stateAfterReduce)
      .map((x) => [x, renameInSession(x, rename)] as const)
      .filter(([before, after]) => before !== after)
      .map(([, after]) => after);
    if (renamedSessions.length) {
      dispatch(upsertStoredSessions(renamedSessions));
    }

    const renamedPlans = Object.fromEntries(
      Object.entries(stateAfterReduce.program.savedPrograms)
        .map(([id, pojo]) => {
          const program = ProgramBlueprint.fromPOJO(pojo);
          return [id, program, renameInProgram(program, rename)] as const;
        })
        .filter(([, before, after]) => before !== after)
        .map(([id, , after]) => [id, after]),
    );
    if (Object.keys(renamedPlans).length) {
      dispatch(upsertSavedPlans(renamedPlans));
    }

    const targets: SessionTarget[] = [
      'workoutSession',
      'historySession',
      'feedSession',
    ];
    for (const target of targets) {
      const session = stateAfterReduce.currentSession[target];
      const renamed = session && renameInSession(session, rename);
      if (session && renamed !== session) {
        dispatch(setCurrentSession({ target, session: renamed }));
      }
    }

    // Finish undoes swaps by name, so they follow the rename too
    for (const [sessionId, swaps] of Object.entries(
      stateAfterReduce.currentSession.exerciseSwaps,
    )) {
      const renamed = renameInSwaps(swaps, rename);
      if (renamed !== swaps) {
        dispatch(setExerciseSwaps({ sessionId, swaps: renamed }));
      }
    }

    // The plan being edited is written back over the saved plan when its
    // screen regains focus, so it has to carry the new name too
    const draft = stateAfterReduce.sessionEditor.sessionBlueprint;
    const renamedDraft = draft && renameInSessionBlueprint(draft, rename);
    if (draft && renamedDraft !== draft) {
      dispatch(setEditingSession(renamedDraft));
    }

    // Notes are keyed by name; when both names have notes, both are kept
    const notes = stateAfterReduce.storedSessions.exerciseNotes;
    const fromNotes = notes[from.toString()];
    if (fromNotes && !sameKey) {
      const toNotes = notes[to.toString()];
      dispatch(
        setExerciseNotes({
          exerciseName: rename.to,
          notes: toNotes ? `${toNotes}\n\n${fromNotes}` : fromNotes,
        }),
      );
      dispatch(setExerciseNotes({ exerciseName: rename.from, notes: '' }));
    }

    // Injury mode keys its pain-check switch and Pull-day decisions by
    // name; a setting the new name already has stays
    if (!sameKey) {
      const { flagOverrides, returnOverrides } = stateAfterReduce.injury;
      const flag = flagOverrides[from.toString()];
      if (flag !== undefined) {
        if (flagOverrides[to.toString()] === undefined) {
          dispatch(setFlagOverride({ name: to.toString(), flagged: flag }));
        }
        dispatch(
          setFlagOverride({ name: from.toString(), flagged: undefined }),
        );
      }
      const decision = returnOverrides[from.toString()];
      if (decision !== undefined) {
        if (returnOverrides[to.toString()] === undefined) {
          dispatch(
            setReturnOverride({ name: to.toString(), override: decision }),
          );
        }
        dispatch(
          setReturnOverride({ name: from.toString(), override: undefined }),
        );
      }
    }

    // The library entry takes the new name unless one already has it
    const library = Object.entries(
      stateAfterReduce.storedSessions.savedExercises,
    );
    const hasTo =
      !sameKey &&
      library.some(([, x]) => new NormalizedName(x.name).equals(to));
    const fromEntries = library.filter(([, x]) =>
      new NormalizedName(x.name).equals(from),
    );
    fromEntries.forEach(([id, entry], i) => {
      // Only capitals or a plural changed: the other entries already share
      // the key, so they stay as they are
      if (sameKey && i > 0) {
        return;
      }
      if (hasTo || i > 0) {
        // The lift lives on under the new name; an entry left with the old
        // name would offer a lift with no history behind it
        dispatch(deleteExercise(id));
      } else {
        dispatch(
          updateExercise({ id, exercise: { ...entry, name: rename.to } }),
        );
      }
    });

    dispatch(setStatsIsDirty(true));
    dispatch(fetchUpcomingSessions());
  });

  addEffect(
    [
      addStoredSession,
      deleteStoredSession,
      setStoredSessions,
      upsertStoredSessions,
      setIsHydrated,
      setMonthlyReportNotifications,
    ],
    (_, { dispatch }) => {
      dispatch(refreshMonthlyReportNotification());
    },
  );

  addEffect(
    refreshMonthlyReportNotification,
    async (
      _,
      { stateAfterReduce, extra: { monthlyReportNotifier, tolgee, logger } },
    ) => {
      // Before history loads every month looks empty; deciding then would
      // cancel a report that is still due
      if (!stateAfterReduce.storedSessions.isHydrated) {
        return;
      }
      try {
        const { settings } = stateAfterReduce;
        if (!settings.monthlyReportNotifications) {
          await monthlyReportNotifier.cancel();
          return;
        }
        const today = LocalDate.now();
        const month = YearMonth.from(today);
        const at = monthlyReportDeliveryTime(month, today);
        const report = monthlyReport({
          sessions: selectSessions(stateAfterReduce),
          month,
          unit: settings.useImperialUnits ? 'pounds' : 'kilograms',
          library: Object.values(
            stateAfterReduce.storedSessions.savedExercises,
          ),
          firstDayOfWeek: settings.firstDayOfWeek,
        });
        if (!at) {
          return;
        }
        if (!report.workouts) {
          // Its workouts were deleted: a report already queued would be stale
          await monthlyReportNotifier.cancel(month);
          return;
        }
        const monthName = new Date(
          month.year(),
          month.monthValue() - 1,
          1,
        ).toLocaleDateString(settings.preferredLanguage, { month: 'long' });
        await monthlyReportNotifier.schedule({
          month,
          at,
          title: tolgee.t('stats.monthly_report.notification.title', {
            month: monthName,
          }),
          body: tolgee.t('stats.monthly_report.notification.body', {
            workouts: report.workouts,
            sets: report.sets,
            bests: report.bests.length,
          }),
        });
      } catch (e) {
        logger.error('Failed to schedule the monthly report notification', e);
      }
    },
  );

  addEffect(
    addStoredSession,
    async (a, { getState, extra: { healthExportService, logger } }) => {
      const workout = a.payload;
      if (
        !getState().settings.exportToHealthAggregator ||
        !healthExportService.canExport()
      ) {
        return;
      }
      try {
        await healthExportService.exportWorkout(workout);
      } catch (e) {
        logger.error('Failed to sync to health aggregator', e);
      }
    },
  );

  addEffect(deleteStoredSession, async (action, { extra: { logger, db } }) => {
    await logger.time('deleteStoredSession', async () => {
      await db
        .delete(sessionsSchema)
        .where(eq(sessionsSchema.id, action.payload));
    });
  });
  addEffect(
    deleteStoredSession,
    async (
      action,
      { stateAfterReduce, extra: { healthExportService, logger } },
    ) => {
      const workoutId = action.payload;
      if (
        !stateAfterReduce.settings.exportToHealthAggregator ||
        !healthExportService.canExport()
      ) {
        return;
      }
      try {
        await healthExportService.deleteWorkout(workoutId);
      } catch (e) {
        logger.error('Failed to delete workout from HealthConnect', e);
      }
    },
  );

  addEffect(
    addStoredSession,
    async (action, { cancelActiveListeners, extra: { db, logger } }) => {
      cancelActiveListeners();
      await logger.time('addStoredSession', async () => {
        const payload = action.payload.toJSON();
        await db
          .insert(sessionsSchema)
          .values({
            id: action.payload.id,
            payload,
          })
          .onConflictDoUpdate({
            target: sessionsSchema.id,
            set: {
              payload: sql.raw(`excluded.${sessionsSchema.payload.name}`),
            },
          });
      });
    },
  );

  addEffect(
    upsertStoredSessions,
    async (action, { cancelActiveListeners, extra: { db, logger } }) => {
      cancelActiveListeners();
      if (action.payload.length === 0) {
        return;
      }
      await logger.time('upsertStoredSessions', async () => {
        const toUpsert = action.payload.map((x) => ({
          id: x.id,
          payload: x.toJSON(),
        }));
        await db
          .insert(sessionsSchema)
          .values(toUpsert)
          .onConflictDoUpdate({
            target: sessionsSchema.id,
            set: {
              payload: sql.raw(`excluded.${sessionsSchema.payload.name}`),
            },
          });
      });
    },
  );

  addEffect(setExerciseNotes, async (action, { extra: { db } }) => {
    const key = new NormalizedName(action.payload.exerciseName).toString();
    if (action.payload.notes.trim()) {
      await db
        .insert(exerciseNotesSchema)
        .values({ id: key, notes: action.payload.notes })
        .onConflictDoUpdate({
          target: exerciseNotesSchema.id,
          set: {
            notes: sql.raw(`excluded.${exerciseNotesSchema.notes.name}`),
          },
        });
    } else {
      await db
        .delete(exerciseNotesSchema)
        .where(eq(exerciseNotesSchema.id, key));
    }
  });

  addEffect(upsertExerciseNotes, async (action, { extra: { db } }) => {
    const values = Object.entries(action.payload).map(([id, notes]) => ({
      id,
      notes,
    }));
    if (!values.length) {
      return;
    }
    await db
      .insert(exerciseNotesSchema)
      .values(values)
      .onConflictDoUpdate({
        target: exerciseNotesSchema.id,
        set: {
          notes: sql.raw(`excluded.${exerciseNotesSchema.notes.name}`),
        },
      });
  });

  addEffect(deleteExercise, async (action, { extra: { db } }) => {
    await db
      .delete(exercisesSchema)
      .where(eq(exercisesSchema.id, action.payload));
  });

  addEffect(updateExercise, async (action, { extra: { db } }) => {
    await db
      .insert(exercisesSchema)
      .values({
        id: action.payload.id,
        payload: toExerciseDescriptorJSON(action.payload.exercise),
      })
      .onConflictDoUpdate({
        target: exercisesSchema.id,
        set: {
          payload: sql.raw(`excluded.${exercisesSchema.payload.name}`),
        },
      });
  });

  addEffect(
    setExercises,
    async (action, { stateAfterReduce, extra: { db } }) => {
      if (!stateAfterReduce.storedSessions.isHydrated) {
        return;
      }
      await db.transaction(async (tx) => {
        await tx.delete(exercisesSchema);
        await tx.insert(exercisesSchema).values(
          Object.entries(action.payload).map(([id, exercise]) => ({
            id,
            payload: toExerciseDescriptorJSON(exercise),
          })),
        );
      });
    },
  );
}
