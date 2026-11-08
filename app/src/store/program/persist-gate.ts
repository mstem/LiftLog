/**
 * Decides whether the program persist effect writes. The effect cancels its
 * previous run on every action, so a plan change followed at once by any other
 * action loses its write; the next run then sees no change of its own. The
 * gate keeps a change owed until a write that started after it finishes.
 *
 * shouldPersist returns the change number a write covers, or undefined when
 * nothing is owed. done(n) settles every change up to n, whether the write
 * saved or failed for good; a cancelled write is not settled.
 */
export function createPersistGate() {
  let latest = 0;
  let settled = 0;
  return {
    shouldPersist(changed: boolean): number | undefined {
      if (changed) {
        latest++;
      }
      return latest > settled ? latest : undefined;
    },
    done(upTo: number) {
      settled = Math.max(settled, upTo);
    },
  };
}
