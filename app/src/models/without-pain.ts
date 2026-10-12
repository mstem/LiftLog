import { FeedUserEvent, SharedItem, SharedSession } from '@/models/feed-models';
import { RecordedWeightedExercise, Session } from '@/models/session-models';

/**
 * A copy of the session with every pain rating and pain stop removed. Pain is health data
 * and stays on the device and in the user's own backup, so anything sent to
 * other people goes through this first.
 */
export function withoutPain(session: Session): Session {
  return session.with({
    recordedExercises: session.recordedExercises.map((e) =>
      e instanceof RecordedWeightedExercise
        ? e.with({
            stoppedForPain: undefined,
            potentialSets: e.potentialSets.map((ps) =>
              ps.set?.pain === undefined
                ? ps
                : ps.with({ set: ps.set.with({ pain: undefined }) }),
            ),
          })
        : e,
    ),
  });
}

export function eventWithoutPain(event: FeedUserEvent): FeedUserEvent {
  return event.type === 'SessionUserEvent'
    ? event.with({ session: withoutPain(event.session) })
    : event;
}

export function sharedItemWithoutPain(item: SharedItem): SharedItem {
  return item.type === 'SharedSession'
    ? new SharedSession(withoutPain(item.session))
    : item;
}
