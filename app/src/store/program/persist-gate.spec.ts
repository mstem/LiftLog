import { describe, expect, it } from 'vitest';
import { createPersistGate } from './persist-gate';

describe('createPersistGate', () => {
  it('persists when the plans changed', () => {
    expect(createPersistGate().shouldPersist(true)).toBe(true);
  });

  it('skips when nothing changed and nothing is owed', () => {
    expect(createPersistGate().shouldPersist(false)).toBe(false);
  });

  it('persists on the next action when a change was cancelled before it saved', () => {
    const gate = createPersistGate();
    gate.shouldPersist(true);
    // The next action cancels that write; it changes no plans itself
    expect(gate.shouldPersist(false)).toBe(true);
  });

  it('owes nothing once a write completes', () => {
    const gate = createPersistGate();
    gate.shouldPersist(true);
    gate.persisted();
    expect(gate.shouldPersist(false)).toBe(false);
  });
});
