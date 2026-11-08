import { describe, expect, it } from 'vitest';
import { createPersistGate } from './persist-gate';

describe('createPersistGate', () => {
  it('persists when the plans changed', () => {
    expect(createPersistGate().shouldPersist(true)).toBeDefined();
  });

  it('skips when nothing changed and nothing is owed', () => {
    expect(createPersistGate().shouldPersist(false)).toBeUndefined();
  });

  it('persists on the next action when a change was cancelled before it saved', () => {
    const gate = createPersistGate();
    gate.shouldPersist(true);
    // The next action cancels that write; it changes no plans itself
    expect(gate.shouldPersist(false)).toBeDefined();
  });

  it('owes nothing once a write completes', () => {
    const gate = createPersistGate();
    gate.done(gate.shouldPersist(true)!);
    expect(gate.shouldPersist(false)).toBeUndefined();
  });

  it('still owes a newer change when an older write finishes late', () => {
    const gate = createPersistGate();
    const older = gate.shouldPersist(true)!;
    gate.shouldPersist(true); // a newer change, whose write gets cancelled
    gate.done(older);
    expect(gate.shouldPersist(false)).toBeDefined();
  });
});
