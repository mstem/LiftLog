/**
 * Decides whether the program persist effect writes. The effect cancels its
 * previous run on every action, so a plan change followed at once by any other
 * action loses its write; the next run then sees no change of its own. The
 * gate remembers the change is still owed until a write completes.
 */
export function createPersistGate() {
  let owed = false;
  return {
    shouldPersist(changed: boolean): boolean {
      owed ||= changed;
      return owed;
    },
    persisted() {
      owed = false;
    },
  };
}
